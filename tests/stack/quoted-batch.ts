import assert from "node:assert/strict";
import type { Keypair, PublicKey } from "@solana/web3.js";
import { prepareTransaction, readQuotePool, quoteSell, validateSellQuote, submitTransaction, transactionStatus } from "../../packages/client/src/index.ts";
import type { FlinchClient } from "../../packages/client/src/index.ts";
import { captureTransaction, walletSigner } from "./client.ts";
import { journal } from "./evidence.ts";
import { poll } from "./rpc.ts";
import type { Stack } from "./bootstrap.ts";

export async function queueQuotedBatch(stack: Stack, client: FlinchClient, ledger: PublicKey, seats: number[], wallets: Keypair[], sessionToken?: PublicKey) {
  const room = await client.readRoom(ledger);
  const pool = await readQuotePool(client.base, room.ledger.pool, room.slot);
  const er = await client.resolve(room);
  const quotes = seats.map(seat => quoteSell(pool, er.control, seat, er.now));
  const instructions = await Promise.all(quotes.map((quote, index) => client.instructions.queue(ledger, wallets[index].publicKey,
    quote.seat, quote.nonce, quote.minimumOutput, sessionToken ?? null)));
  const prepared = await prepareTransaction(er.connection, instructions, walletSigner(wallets), "legacy");
  const latest = await client.resolve(await client.readRoom(ledger, room.slot));
  assert.equal(latest.connection.rpcEndpoint, er.connection.rpcEndpoint);
  quotes.forEach(quote => validateSellQuote(quote, latest.control, latest.now));
  journal(stack.directory, "quoted-intents", { ...prepared.submission, quotes: quotes.map(quote => ({
    seat: quote.seat, revision: quote.revision.toString(), cohort: quote.cohortIndex, nonce: quote.nonce.toString(),
    minimum: quote.minimumOutput.toString(), low: quote.outputLow.toString(), high: quote.outputHigh.toString(), poolSlot: quote.poolSlot })) });
  await submitTransaction(er.connection, prepared);
  await poll("quoted intents confirm", async () => {
    const status = await transactionStatus(er.connection, prepared.submission.signature);
    assert.notEqual(status.kind, "failed");
    return status.kind === "confirmed" ? true : undefined;
  });
  await captureTransaction(stack, er.connection, prepared.submission.signature, "quote-backed SELL");
  return quotes;
}
