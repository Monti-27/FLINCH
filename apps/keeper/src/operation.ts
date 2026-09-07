import { PublicKey } from "@solana/web3.js";
import { isTransactionSignature as signature, u64 } from "@flinch/client";
import type { Operation } from "./store.ts";

const fields = new Set(["version", "room", "action", "revision", "signature", "blockhash", "lastValidBlockHeight", "runtime", "endpoint", "genesis", "status", "observedSlot", "confirmationSlot", "returnSignature"]);

export function validateOperation(value: unknown, room: string): Operation {
  if (!value || typeof value !== "object") throw new Error("Invalid operation journal");
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some(key => !fields.has(key)) || record.version !== 1 || record.room !== room || !signature(record.signature)
    || typeof record.blockhash !== "string" || typeof record.genesis !== "string" || typeof record.endpoint !== "string"
    || !["base", "er"].includes(String(record.runtime)) || !["pending", "confirmed", "failed", "superseded"].includes(String(record.status))
    || !["start", "cancel", "delegate", "freeze", "execute", "expire", "recover"].includes(String(record.action))
    || !(record.revision === null || typeof record.revision === "string" && /^(0|[1-9]\d*)$/.test(record.revision))
    || !Number.isSafeInteger(record.lastValidBlockHeight) || Number(record.lastValidBlockHeight) < 0
    || !Number.isSafeInteger(record.observedSlot) || Number(record.observedSlot) < 0
    || !(record.confirmationSlot === undefined || Number.isSafeInteger(record.confirmationSlot) && Number(record.confirmationSlot) >= 0 && ["confirmed", "failed"].includes(String(record.status)))
    || !(record.returnSignature === undefined || signature(record.returnSignature))) throw new Error("Invalid operation journal fields");
  if (record.revision !== null) u64(BigInt(record.revision as string));
  new PublicKey(room);
  new PublicKey(record.blockhash);
  new PublicKey(record.genesis);
  const url = new URL(record.endpoint);
  if (url.username || url.password || url.search || url.hash) throw new Error("Journal endpoint contains forbidden URL fields");
  if ((record.action === "freeze") !== (record.runtime === "er")) throw new Error("Operation runtime differs from action");
  return Object.freeze({ ...record }) as Operation;
}

export function appendOperation(history: readonly Operation[], operation: Operation): readonly Operation[] {
  const next = validateOperation(operation, operation.room);
  const previous = history.at(-1);
  if (previous) {
    if (previous.genesis !== next.genesis || previous.room !== next.room) throw new Error("Journal identity changed");
    if (previous.signature === next.signature) {
      const immutable = (value: Operation) => JSON.stringify(Object.fromEntries(Object.entries(value).filter(([key, item]) => !["status", "confirmationSlot"].includes(key) && item !== undefined).sort(([a], [b]) => a.localeCompare(b))));
      if (immutable(previous) !== immutable(next)) throw new Error("Operation identity changed");
      if (previous.status === next.status) return history;
      if (previous.status !== "pending") throw new Error("Operation is already resolved");
    } else if (previous.status === "pending") throw new Error("Cannot replace an uncertain operation");
  }
  if (history.length >= 2048) throw new Error("Operation journal capacity reached");
  return [...history, next];
}
