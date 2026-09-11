import type { PublicKey } from "@solana/web3.js";
import type { FlinchClient } from "../client.ts";
import { check } from "../errors.ts";
import type { PoolSnapshot } from "./read.ts";
import { quoteSell, validateSellQuote } from "./sell.ts";

export function observationTime(now: bigint, observedAtMs: number, wallTime = Date.now()) {
  const elapsed = wallTime - observedAtMs;
  check(Number.isSafeInteger(elapsed) && elapsed >= 0 && elapsed < 2000, "Quote expired; refresh before signing");
  return now + BigInt(Math.floor(elapsed / 1000));
}

export async function readSellContext(client: Pick<FlinchClient, "readRoom" | "resolve">,
  readPool: (pool: PublicKey, slot: number) => Promise<PoolSnapshot>,
  ledger: PublicKey, seat: number, slippageBps: number, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const room = await client.readRoom(ledger);
  const pool = await readPool(room.ledger.pool, room.slot);
  signal?.throwIfAborted();
  const observedAtMs = Date.now();
  const er = await client.resolve(room, signal);
  signal?.throwIfAborted();
  const now = observationTime(er.now, observedAtMs);
  const quote = quoteSell(pool, er.control, seat, now, slippageBps);
  validateSellQuote(quote, er.control, now);
  return { quote, er, observedAtMs };
}
