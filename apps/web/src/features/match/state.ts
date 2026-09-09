import { PublicKey } from "@solana/web3.js";
import type { BaseRoom, Control } from "@flinch/client";

export function roomStatus(room: BaseRoom, control?: Control) {
  const e = room.ledger.economics;
  if (room.ledger.phase === "cancelled") return "Cancelled · refunds available";
  if (!e) return room.now >= room.ledger.fundingDeadline ? "Lobby expired · cancel to refund" : "Waiting for four players";
  if (e.terminalTag === 1) return `Seat ${e.terminalSeat + 1} held last`;
  if (e.terminalTag === 2) return "Everyone exited";
  if (e.terminalTag) return "Round ended · remaining WSOL can be claimed";
  if (room.now >= e.startedAt + 120n) return "Recovery available on Solana";
  if (room.now >= e.startedAt + 90n) return "Time is up · resolving remaining positions";
  if (room.control.kind === "base" && room.control.value.phase === "frozen") return "Control returned · waiting for swap or expiry";
  if (control?.phase === "frozen") return "Returning control to Solana";
  if (control?.sellers) return "SELL queued · WSOL has not sold yet";
  return control?.phase === "live" ? "Live on MagicBlock" : "Preparing MagicBlock · timer continues";
}

export function seatState(room: BaseRoom, seat: number, control?: Control) {
  if (room.ledger.wallets[seat].equals(PublicKey.default)) return "Open seat";
  if (room.ledger.refunded[seat]) return "Refunded";
  const e = room.ledger.economics;
  if (!e) return "Funded";
  if (e.usdcClaims[seat] > 0n) return "USDC claimable";
  if (e.holdings[seat] === 0n) return "Position closed · nothing to claim";
  if (e.terminalTag) return "WSOL claimable";
  if (control && (control.sellers & (1 << seat))) return "SELL queued";
  return "Holding WSOL";
}

export function claimable(room: BaseRoom, seat: number, asset: "wsol" | "usdc") {
  if (seat < 0) return 0n;
  if (asset === "wsol" && room.ledger.phase === "cancelled") return room.ledger.refunded[seat] ? 0n : room.ledger.stake;
  const e = room.ledger.economics;
  return !e ? 0n : asset === "usdc" ? e.usdcClaims[seat] : e.terminalTag ? e.holdings[seat] : 0n;
}
