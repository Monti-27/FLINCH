import { PublicKey } from "@solana/web3.js";
import { claimable } from "../match/state.ts";
import type { BaseRoom } from "@flinch/client";
import type { Operation } from "../../lib/operation.ts";

export type ClaimAsset = "wsol" | "usdc";
export type Withdrawal = Readonly<{ asset: ClaimAsset; amount: bigint }>;

export function withdrawalState(room: BaseRoom, seat: number) {
  const seated = Number.isInteger(seat) && seat >= 0 && seat < room.ledger.wallets.length
    && !room.ledger.wallets[seat].equals(PublicKey.default);
  const economics = room.ledger.economics;
  const cancelled = room.ledger.phase === "cancelled";
  const ended = cancelled || !!economics?.terminalTag;
  const exited = seated && economics?.holdings[seat] === 0n;
  const recovery = !!economics && !economics.terminalTag && room.now >= economics.startedAt + 120n;
  const withdrawals: Withdrawal[] = seated ? (["wsol", "usdc"] as const)
    .map(asset => ({ asset, amount: claimable(room, seat, asset) })).filter(value => value.amount > 0n) : [];
  const closed = seated && (ended || exited) && withdrawals.length === 0;
  return { withdrawals, recovery, closed, visible: recovery || closed || withdrawals.length > 0,
    replacesPosition: recovery || (seated && (ended || exited)),
    context: cancelled ? "Room cancelled" : exited ? "Exit confirmed on Solana" : "Confirmed on Solana" };
}

export function pendingWithdrawal(operation: Operation | undefined, room: BaseRoom, wallet: string | undefined, genesis: string) {
  const pending = operation?.status === "pending" && operation.runtime === "base" && operation.wallet === wallet
    && operation.genesis === genesis && operation.room === room.ledger.address.toBase58();
  return { claim: !!pending && operation.action !== "Recover round", recovery: !!pending && operation.action === "Recover round" };
}
