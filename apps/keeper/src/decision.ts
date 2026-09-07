import { PublicKey } from "@solana/web3.js";
import { closesAt, endsAt, recoveryAt } from "@flinch/client";
import type { BaseRoom, Control } from "@flinch/client";

export type Action = "start" | "cancel" | "delegate" | "freeze" | "execute" | "expire" | "recover";
export type Decision = { kind: "act"; action: Action; revision: bigint | null }
  | { kind: "resolve" } | { kind: "wait"; reason: string } | { kind: "done" };

export function decide(room: BaseRoom, ephemeral?: { control: Control; now: bigint }): Decision {
  const ledger = room.ledger;
  const e = ledger.economics;
  if (ledger.phase === "cancelled" || e && e.terminalTag !== 0) return { kind: "done" };
  if (ledger.phase === "funding") {
    if (room.now >= ledger.fundingDeadline) return { kind: "act", action: "cancel", revision: null };
    return ledger.wallets.every(key => !key.equals(PublicKey.default)) ? { kind: "act", action: "start", revision: null } : { kind: "wait", reason: "funding" };
  }
  if (!e) return { kind: "wait", reason: "missing economics" };
  const act = (action: Action): Decision => ({ kind: "act", action, revision: e.revision });
  if (room.now >= recoveryAt(e)) return act("recover");
  if (room.control.kind === "missing" || room.control.kind === "not_required") return { kind: "wait", reason: "missing control" };
  if (room.control.kind === "delegated") {
    if (!ephemeral) return { kind: "resolve" };
    if (ephemeral.control.phase === "live" && ephemeral.control.sellers !== 0 && ephemeral.now >= closesAt(ephemeral.control)) return act("freeze");
    return { kind: "wait", reason: ephemeral.control.phase === "frozen" ? "returning control" : "open cohort" };
  }
  const control = room.control.value;
  if (control.revision !== e.revision || control.startedAt !== e.startedAt || control.nextCohort !== e.nextCohort
    || control.holdings.some((amount, seat) => amount !== e.holdings[seat])) return { kind: "wait", reason: "control snapshot differs" };
  if (control.phase === "prepared" || control.phase === "resolved") return room.now < endsAt(e) ? act("delegate") : { kind: "wait", reason: "awaiting recovery cutoff" };
  if (control.phase !== "frozen" || control.sellers === 0) return { kind: "wait", reason: "control is not executable" };
  if (room.now < closesAt(control)) return { kind: "wait", reason: "base clock precedes cohort close" };
  return room.now >= closesAt(control) + 15n ? act("expire") : act("execute");
}
