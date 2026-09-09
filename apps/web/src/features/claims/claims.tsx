"use client";

import { useMemo } from "react";
import { useStore } from "zustand";
import { NATIVE_MINT, createAssociatedTokenAccountIdempotentInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { USDC_MINT } from "@flinch/client";
import type { BaseRoom, FlinchClient, TransactionSigner } from "@flinch/client";
import { Button } from "../../components/ui/button.tsx";
import { createClaimActionStore } from "../../stores/claim-action-store.ts";
import { pendingWithdrawal, withdrawalState } from "./withdrawal-state.ts";
import type { ClaimAsset } from "./withdrawal-state.ts";
import { WithdrawalDetails, WithdrawalTicket } from "./withdrawal-ticket.tsx";
import type { ActionRequest } from "../../lib/use-actions.ts";
import type { Operation } from "../../lib/operation.ts";
import styles from "./withdrawal.module.css";
import { notifyActionError } from "../../lib/notify-action.ts";

export function Claims({ client, room, seat, signer, busy, enabled, operation, run }: { client: FlinchClient; room: BaseRoom; seat: number;
  signer?: TransactionSigner; busy: boolean; enabled: boolean; operation?: Operation; run: (request: ActionRequest) => Promise<unknown> }) {
  const address = room.ledger.address.toBase58();
  const wallet = signer?.publicKey.toBase58();
  const store = useMemo(createClaimActionStore, [client, address, wallet]);
  const { action, execute } = useStore(store);
  const view = withdrawalState(room, seat);
  const pending = pendingWithdrawal(operation, room, wallet, client.config.expectedGenesis);
  const disabled = !enabled || busy || !!action || !signer;
  if (!view.visible) return null;
  const claim = (asset: ClaimAsset) => {
    if (disabled || pending.claim || !signer || !room.ledger.wallets[seat]?.equals(signer.publicKey)
      || !view.withdrawals.some(value => value.asset === asset)) return;
    void execute(asset, async () => {
      const mint = asset === "wsol" ? NATIVE_MINT : USDC_MINT;
      const destination = getAssociatedTokenAddressSync(mint, signer.publicKey);
      await run({ label: `Claim ${asset.toUpperCase()}`, room: room.ledger.address, signer, instructions: [
        createAssociatedTokenAccountIdempotentInstruction(signer.publicKey, destination, signer.publicKey, mint),
        await client.instructions.claim(room.ledger.address, signer.publicKey, asset)] });
    }, error => { notifyActionError(error, { action: `Claim ${asset.toUpperCase()}` }); });
  };
  const recover = () => {
    if (disabled || pending.recovery || !signer || !view.recovery) return;
    void execute("recover", async () => run({ label: "Recover round", room: room.ledger.address, signer,
      instructions: [await client.instructions.recover(room.ledger.address)] }), error => { notifyActionError(error, { action: "Recover round" }); });
  };
  return <section className="panel withdrawal-panel" aria-labelledby="withdrawal-title">
    <div className={styles.header}>
      <h2 id="withdrawal-title">{view.withdrawals.length ? "Ready to withdraw" : view.recovery ? "Recovery available" : "Withdrawals complete"}</h2>
      {view.withdrawals.length > 0 && <p className={styles.context}>{view.context}</p>}
    </div>
    {view.withdrawals.map(withdrawal => <WithdrawalTicket key={withdrawal.asset} withdrawal={withdrawal} refund={room.ledger.phase === "cancelled"}
      disabled={disabled} loading={action === withdrawal.asset} pending={pending.claim} onClaim={claim} />)}
    {view.closed && <p className={styles.complete}>No tokens remain claimable for your seat.</p>}
    {view.recovery && <div className={styles.recovery}>
      <p>Close the round on Solana to release unsold WSOL. Earlier sales stay settled; MagicBlock does not need to be online.</p>
      <Button variant={view.withdrawals.length ? "secondary" : "default"} size="lg" disabled={disabled || pending.recovery} isLoading={action === "recover"} onClick={recover}>Recover round</Button>
      {(action === "recover" || pending.recovery) && <p role="status">{action === "recover" ? "Waiting for Solana confirmation…" : "Recovery is unconfirmed. Use Check transaction."}</p>}
    </div>}
    {view.withdrawals.length > 0 && <WithdrawalDetails wrapped={view.withdrawals.some(value => value.asset === "wsol")} />}
  </section>;
}
