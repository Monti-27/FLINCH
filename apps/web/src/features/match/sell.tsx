"use client";

import { useRef, useState } from "react";
import type { BaseRoom, Control, FlinchClient, TransactionSigner } from "@flinch/client";
import { sessionSigner } from "../../lib/session.ts";
import type { Session } from "../../lib/session.ts";
import type { ActionRequest } from "../../lib/use-actions.ts";
import { SellTicket } from "./sell-ticket.tsx";
import { sellRequest } from "./sell-request.ts";
import { sellState } from "./sell-state.ts";
import { useSellQuote } from "./use-sell-quote.ts";
import { notifyActionError } from "../../lib/notify-action.ts";
import styles from "./sell-ticket.module.css";

export function Sell({ client, room, control, controlNow = room.now, seat, wallet, session, busy, enabled, wallTime, run }: { client: FlinchClient;
  room: BaseRoom; control?: Control; seat: number; wallet?: TransactionSigner; session?: Session; busy: boolean; enabled: boolean;
  wallTime: number; controlNow?: bigint; run: (request: ActionRequest) => Promise<unknown> }) {
  const queuing = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const { available, ended, closed, exited, pending, active, unavailable } = sellState(room, control, seat, controlNow);
  const feed = useSellQuote(client, room.ledger.address, seat, wallet?.publicKey.toBase58(), available && !!wallet && !busy && !submitting,
    room.ledger.economics?.revision);
  const { quote, loading } = feed;
  const { fresh, reviewable, quoteIssue } = sellState(room, control, seat, controlNow, quote, wallTime);
  const sessionReady = session && wallet && session.authority.equals(wallet.publicKey) && session.room.equals(room.ledger.address)
    && control?.sessionSigners[seat]?.equals(session.signer.publicKey) && controlNow < session.expiresAt;
  const queue = async () => {
    if (!quote || !wallet || !reviewable || !enabled || busy || queuing.current || feed.paused) return;
    queuing.current = true;
    setSubmitting(true);
    feed.stop();
    try {
      const signer = sessionReady ? sessionSigner(session) : wallet;
      await run(sellRequest(client, quote, signer, sessionReady ? session.token : undefined, feed.update));
    } catch (value) { notifyActionError(value, { action: "Queue SELL" }); }
    finally { queuing.current = false; setSubmitting(false); }
  };
  return <section className="panel sell-panel" aria-labelledby="sell-title">
    <div className={styles.header}>
      <h2 id="sell-title">{ended ? "Round complete" : exited ? "Exit confirmed" : closed ? "Selling closed" : pending ? "Sell queued" : "Your position"}</h2>
      {active && wallet && <span className="caption">{sessionReady ? "Signing with session key" : "Signing with wallet approval"}</span>}
    </div>
    {active && <SellTicket key={`${room.ledger.address}:${seat}`} holding={seat >= 0 ? room.ledger.economics?.holdings[seat] ?? 0n : undefined}
      quote={quote} fresh={fresh} quoteIssue={quoteIssue} sessionReady={!!sessionReady} loading={loading} busy={busy || submitting}
      canQuote={available && !!wallet && !feed.paused} canQueue={reviewable && enabled && !!wallet && !feed.paused}
      automatic failed={feed.failed} paused={feed.paused}
      onQuote={() => void feed.refresh()} onQueue={() => void queue()} />}
    {unavailable && <p className={styles.state}>{unavailable}</p>}
    {wallet && active && <p className={styles.note}>Price is checked again before sending. Your approved minimum stays fixed.</p>}
    {active && <p className={styles.note}>Queued is not sold. The Solana swap confirms your exit.</p>}
  </section>;
}
