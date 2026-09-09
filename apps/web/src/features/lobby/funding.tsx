"use client";

import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import type { BaseRoom, FlinchClient, TransactionSigner } from "@flinch/client";
import { Button } from "../../components/ui/button.tsx";
import { TicketDisclosure } from "../../components/ui/ticket-disclosure.tsx";
import { FundingTicket } from "./funding-ticket.tsx";
import styles from "./funding.module.css";
import type { Session } from "../../lib/session.ts";
import { boundSessionToken, withSession, revokeSession } from "../../lib/session.ts";
import { joinInstructions } from "./instructions.ts";
import type { ActionRequest } from "../../lib/use-actions.ts";
import { notifyActionError } from "../../lib/notify-action.ts";

export function Funding({ client, room, signer, session, remember, busy, enabled, run }: { client: FlinchClient; room: BaseRoom;
  signer?: TransactionSigner; session?: Session; remember: (session?: Session) => void; busy: boolean; enabled: boolean;
  run: (request: ActionRequest) => Promise<unknown> }) {
  const [useSession, setUseSession] = useState(true);
  const full = room.ledger.wallets.every(key => !key.equals(PublicKey.default));
  const joined = !!signer && room.ledger.wallets.some(key => key.equals(signer.publicKey));
  const seat = signer ? room.ledger.wallets.findIndex(key => key.equals(signer.publicKey)) : -1;
  const bound = seat >= 0 && !room.ledger.sessionSigners[seat].equals(PublicKey.default);
  const funding = room.ledger.phase === "funding";
  const canPrepare = room.control.kind === "base" && ["prepared", "resolved"].includes(room.control.value.phase) && !room.ledger.economics?.terminalTag;
  const canCancel = funding && !!signer && (room.ledger.host.equals(signer.publicKey) || room.now >= room.ledger.fundingDeadline);
  const canRevoke = (!!session || bound) && !!signer;
  const action = async (label: string) => {
    if (!signer) return;
    try {
      const instruction = label === "Start round" ? await client.instructions.start(room.ledger.address, signer.publicKey)
        : label === "Prepare MagicBlock" ? await client.instructions.delegate(room.ledger.address, signer.publicKey)
        : await client.instructions.cancel(room.ledger.address, signer.publicKey);
      await run({ label, room: room.ledger.address, signer, instructions: [instruction] });
    } catch (value) { notifyActionError(value, { action: label }); }
  };
  const join = async () => {
    if (!signer) return;
    try {
      const fresh = await client.readRoom(room.ledger.address);
      const plan = await joinInstructions(client, fresh, signer.publicKey, useSession);
      remember(plan.session);
      await run({ label: "Join room", room: room.ledger.address, signer: withSession(signer, plan.session), instructions: plan.instructions });
    } catch (value) { notifyActionError(value, { action: "Join room" }); }
  };
  const revoke = async () => {
    if (!signer) return;
    const token = session?.token;
    remember(undefined);
    try { await run({ label: "Revoke session", room: room.ledger.address, signer,
      instructions: [await revokeSession(client.base, signer.publicKey, token ?? await boundSessionToken(client.base, signer.publicKey, room.ledger.sessionSigners[seat], client.programId))] }); }
    catch (value) { notifyActionError(value, { action: "Revoke session" }); }
  };
  const utilities = <>
    <p className={styles.sessionState}><span>SELL session</span><strong>{session ? "Stored on this device" : bound ? "Bound to your seat" : "Not connected"}</strong></p>
    {(canCancel || canRevoke) && <div className={styles.utilities}>
      {canCancel && <Button variant="secondary" disabled={busy || !enabled} onClick={() => void action("Cancel room")}>Cancel room</Button>}
      {canRevoke && <Button variant="secondary" aria-label="Stop session and request revocation" disabled={busy || !enabled} onClick={() => void revoke()}>Revoke SELL session</Button>}
    </div>}
    <p className={styles.note}>Your wallet pays network fees. A connected keeper must return and settle batches.</p>
    {canRevoke && <p className={styles.note}>Revocation visibility on MagicBlock may lag Solana. A session cannot claim or move your wallet tokens.</p>}
  </>;
  return <section className="panel funding-panel">
    {funding && <FundingTicket stake={room.ledger.stake} joined={joined} seat={seat}
      occupied={room.ledger.wallets.filter(key => !key.equals(PublicKey.default)).length}
      expired={room.now >= room.ledger.fundingDeadline} disabled={busy || !signer || !enabled} busy={busy}
      useSession={useSession} setUseSession={setUseSession} onJoin={() => void join()} />}
    {(funding && full || canPrepare) && <div className={styles.operations}>
      {funding && full && <Button size="lg" disabled={busy || !signer || !enabled} onClick={() => void action("Start round")}>Start round</Button>}
      {canPrepare && <Button size="lg" disabled={busy || !signer || !enabled} onClick={() => void action("Prepare MagicBlock")}>Prepare MagicBlock</Button>}
    </div>}
    {funding ? <TicketDisclosure title="Room & session controls" className={styles.management}>{utilities}</TicketDisclosure> : utilities}
  </section>;
}
