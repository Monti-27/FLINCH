"use client";

import { useState } from "react";
import type { BaseRoom, Control, FlinchClient, SellQuote, TransactionSigner } from "@flinch/client";
import { sessionSigner } from "../../lib/session.ts";
import type { Session } from "../../lib/session.ts";
import type { ActionRequest } from "../../lib/use-actions.ts";
import { SellTicket } from "./sell-ticket.tsx";
import { sellRequest } from "./sell-request.ts";
import { sellState } from "./sell-state.ts";
import { notifyActionError } from "../../lib/notify-action.ts";
import styles from "./sell-ticket.module.css";

export function Sell({ client, room, control, controlNow = room.now, seat, wallet, session, busy, enabled, wallTime, run }: { client: FlinchClient;
  room: BaseRoom; control?: Control; seat: number; wallet?: TransactionSigner; session?: Session; busy: boolean; enabled: boolean;
  wallTime: number; controlNow?: bigint; run: (request: ActionRequest) => Promise<unknown> }) {
  const [quote, setQuote] = useState<SellQuote>();
  const [loading, setLoading] = useState(false);
  const { available, fresh, ended, exited, pending, active, unavailable, quoteIssue } = sellState(room, control, seat, controlNow, quote, wallTime);
  const sessionReady = session && wallet && session.authority.equals(wallet.publicKey) && session.room.equals(room.ledger.address)
    && control?.sessionSigners[seat]?.equals(session.signer.publicKey) && controlNow < session.expiresAt;
  const getQuote = async () => {
    setLoading(true); setQuote(undefined);
    try { setQuote(await client.quote(room.ledger.address, seat)); }
    catch (value) { notifyActionError(value, { action: "Get sell quote" }); }
    finally { setLoading(false); }
  };
  const queue = async () => {
    if (!quote || !wallet) return;
    try {
      const signer = sessionReady ? sessionSigner(session) : wallet;
      await run(sellRequest(client, quote, signer, sessionReady ? session.token : undefined));
      setQuote(undefined);
    } catch (value) { notifyActionError(value, { action: "Queue SELL" }); }
  };
  return <section className="panel sell-panel" aria-labelledby="sell-title">
    <div className={styles.header}>
      <h2 id="sell-title">{ended ? "Round complete" : exited ? "Exit confirmed" : pending ? "Sell queued" : "Your position"}</h2>
      {active && wallet && <span className="caption">{sessionReady ? "Signing with session key" : "Signing with wallet approval"}</span>}
    </div>
    {active && <SellTicket key={`${room.ledger.address}:${seat}`} holding={seat >= 0 ? room.ledger.economics?.holdings[seat] ?? 0n : undefined}
      quote={quote} fresh={fresh} quoteIssue={quoteIssue} sessionReady={!!sessionReady} loading={loading} busy={busy}
      canQuote={available && !!wallet} canQueue={available && enabled && !!wallet}
      onQuote={() => void getQuote()} onQueue={() => void queue()} />}
    {unavailable && <p className={styles.state}>{unavailable}</p>}
    {!sessionReady && wallet && active && <p className={styles.note}>Wallet approval must finish before the quote expires. Refresh never signs.</p>}
    {active && <p className={styles.note}>Queued is not sold. The Solana swap confirms your exit.</p>}
  </section>;
}
