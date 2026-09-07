import type { BaseRoom } from "@flinch/client";
import type { Operation } from "./store.ts";
import type { Decision } from "./decision.ts";

export function deadlineSupersedes(operation: Operation, decision: Decision): boolean {
  if (decision.kind !== "act") return false;
  if (decision.action === "recover") return operation.action !== "recover";
  return decision.action === "expire" && operation.action === "execute" && operation.revision === decision.revision?.toString();
}

export function superseded(operation: Operation, room: BaseRoom): boolean {
  const e = room.ledger.economics;
  if (room.ledger.phase === "cancelled" || e && e.terminalTag !== 0) return true;
  if (operation.action === "start") return room.ledger.phase === "started";
  if (!e || operation.revision === null) return false;
  if (e.revision > BigInt(operation.revision)) return true;
  if (e.revision !== BigInt(operation.revision)) return false;
  if (operation.action === "delegate") return room.control.kind === "delegated";
  if (operation.action === "freeze") return room.control.kind === "base" && room.control.value.phase === "frozen";
  return false;
}
