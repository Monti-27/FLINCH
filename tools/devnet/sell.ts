import assert from "node:assert/strict";
import { setTimeout } from "node:timers/promises";
import type { Keypair, PublicKey } from "@solana/web3.js";
import { ClientError, readQuotePool, quoteSell, validateSellQuote, prepareTransaction } from "../../packages/client/src/index.ts";
import type { FlinchClient } from "../../packages/client/src/index.ts";
import type { Session } from "../../apps/web/src/lib/session.ts";
import { record, signerFor } from "./operations.ts";
import { networkFailure } from "./read-retry.ts";

const transient = new Set(["Pool quote is stale", "Quote expired; refresh before signing", "Quote cohort closed",
  "Cohort is returning or closed", "Cohort changed; refresh quote"]);

export function preparationFailure(error: unknown) {
  return error instanceof ClientError
    ? { code: error.code, reason: transient.has(error.message) ? error.message : error.code }
    : { code: error instanceof assert.AssertionError ? "assertion" : "unexpected", network: networkFailure(error),
      name: error instanceof Error && ["Error", "TypeError", "TimeoutError", "AbortError", "SendTransactionError"].includes(error.name) ? error.name : "other" };
}

export async function prepareFresh<T>(build: () => Promise<T>, report: (value: unknown) => Promise<void>, signal: AbortSignal) {
  for (let attempt = 0; attempt < 12; attempt++) {
    signal.throwIfAborted();
    try { return await build(); }
    catch (error) {
      const retryable = !!networkFailure(error) || error instanceof ClientError && (error.code === "placement_pending" || transient.has(error.message));
      await report({ event: "sell-preparation-rejected", attempt, notSubmitted: true, retryable, ...preparationFailure(error) });
      if (!retryable || attempt === 11) throw error;
      await setTimeout(250, undefined, { signal });
    }
  }
  throw new Error("Sell preparation exhausted");
}

export async function prepareDevnetSell(client: FlinchClient, ledger: PublicKey, seats: readonly number[], keys: Keypair[],
  session: Session | undefined, directory: string, index: number, batch: number, signal: AbortSignal) {
  return prepareFresh(async () => {
    const room = await client.readRoom(ledger);
    assert.equal(room.ledger.economics?.revision, BigInt(batch));
    const current = await client.resolve(room, signal);
    const pool = await readQuotePool(client.base, room.ledger.pool, room.slot);
    const quotes = seats.map(seat => quoteSell(pool, current.control, seat, current.now));
    const instructions = await Promise.all(quotes.map((quote, i) => client.instructions.queue(ledger, keys[i].publicKey,
      quote.seat, quote.nonce, quote.minimumOutput, session?.token ?? null)));
    const prepared = await prepareTransaction(current.connection, instructions, signerFor(keys), "legacy", async () => {
      quotes.forEach(quote => validateSellQuote(quote, current.control, current.now));
    });
    const latest = await client.resolve(await client.readRoom(ledger, pool.slot), signal);
    assert.equal(latest.connection.rpcEndpoint, current.connection.rpcEndpoint);
    quotes.forEach(quote => validateSellQuote(quote, latest.control, latest.now));
    await record(directory, { event: "quoted-sell", index, batch, quotes, endpoint: current.connection.rpcEndpoint,
      placement: latest.placement, control: latest.control, erNow: latest.now, erSlot: latest.slot });
    return { prepared, quotes, connection: current.connection };
  }, value => record(directory, { index, batch, ...value as object }), signal);
}
