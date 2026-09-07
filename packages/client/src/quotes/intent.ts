import type { PublicKey } from "@solana/web3.js";
import type { FlinchClient } from "../client.ts";
import { check } from "../errors.ts";
import { prepareTransaction, submitTransaction } from "../transactions.ts";
import type { PreparedTransaction, TransactionSigner } from "../transactions.ts";
import { validateSellQuote } from "./sell.ts";
import type { SellQuote } from "./sell.ts";

type SellClient = Pick<FlinchClient, "readRoom" | "resolve" | "instructions">;
export type PreparedSell = Readonly<{ quote: SellQuote; endpoint: string; prepared: PreparedTransaction }>;
export class SellNotSubmittedError extends Error {}

async function currentPlacement(client: SellClient, quote: SellQuote, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const room = await client.readRoom(quote.ledger, quote.poolSlot);
  check(room.ledger.pool.equals(quote.pool), "Quote venue differs from room");
  const er = await client.resolve(room, signal);
  validateSellQuote(quote, er.control, er.now);
  signal?.throwIfAborted();
  return er;
}

export async function prepareQuotedSell(client: SellClient, quote: SellQuote, signer: TransactionSigner,
  options: { sessionToken?: PublicKey; signal?: AbortSignal; messageVersion?: "v0" | "legacy" } = {}): Promise<PreparedSell> {
  const er = await currentPlacement(client, quote, options.signal);
  const expected = options.sessionToken ? er.control.sessionSigners[quote.seat] : er.control.wallets[quote.seat];
  check(expected.equals(signer.publicKey), "Signer is not authorized for this seat");
  const instruction = await client.instructions.queue(quote.ledger, signer.publicKey, quote.seat, quote.nonce, quote.minimumOutput, options.sessionToken ?? null);
  const prepared = await prepareTransaction(er.connection, [instruction], signer, options.messageVersion, async () => {
    options.signal?.throwIfAborted();
    validateSellQuote(quote, er.control, er.now);
  });
  validateSellQuote(quote, er.control, er.now);
  options.signal?.throwIfAborted();
  return { quote, endpoint: er.connection.rpcEndpoint, prepared };
}

export async function submitQuotedSell(client: SellClient, sell: PreparedSell, signal?: AbortSignal) {
  let er: Awaited<ReturnType<typeof currentPlacement>>;
  try {
    er = await currentPlacement(client, sell.quote, signal);
    check(er.connection.rpcEndpoint === sell.endpoint, "Control placement changed after signing");
  } catch (error) { throw new SellNotSubmittedError(error instanceof Error ? error.message : "Sell validation failed before submission", { cause: error }); }
  return submitTransaction(er.connection, sell.prepared);
}
