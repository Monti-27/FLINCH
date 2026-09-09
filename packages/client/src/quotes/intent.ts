import type { PublicKey } from "@solana/web3.js";
import type { FlinchClient } from "../client.ts";
import { check } from "../errors.ts";
import { prepareTransaction, submitTransaction } from "../transactions.ts";
import type { PreparedTransaction, TransactionSigner } from "../transactions.ts";
import { validateSellQuote } from "./sell.ts";
import type { SellQuote } from "./sell.ts";
import { isQuoteTimingError, refreshSellQuote } from "./refresh.ts";

type SellClient = Pick<FlinchClient, "readRoom" | "resolve"> & { instructions: Pick<FlinchClient["instructions"], "queue"> }
  & Partial<Pick<FlinchClient, "quote">>;
export type PreparedSell = Readonly<{ quote: SellQuote; endpoint: string; prepared: PreparedTransaction; refreshQuote?: boolean }>;
export class SellNotSubmittedError extends Error {}

async function refresh(client: SellClient, quote: SellQuote, signal?: AbortSignal) {
  check(!!client.quote, "Quote refresh is unavailable");
  return refreshSellQuote({ quote: client.quote!.bind(client) }, quote, signal);
}

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
  options: { sessionToken?: PublicKey; signal?: AbortSignal; messageVersion?: "v0" | "legacy";
    refreshQuote?: boolean; onQuote?: (quote: SellQuote) => void } = {}): Promise<PreparedSell> {
  for (let attempt = 0; ; attempt++) {
    let prompted = false;
    try {
      const current = options.refreshQuote ? await refresh(client, quote, options.signal) : quote;
      const er = await currentPlacement(client, current, options.signal);
      const expected = options.sessionToken ? er.control.sessionSigners[current.seat] : er.control.wallets[current.seat];
      check(expected.equals(signer.publicKey), "Signer is not authorized for this seat");
      const instruction = await client.instructions.queue(current.ledger, signer.publicKey, current.seat, current.nonce, current.minimumOutput, options.sessionToken ?? null);
      const prepared = await prepareTransaction(er.connection, [instruction], { publicKey: signer.publicKey, sign: tx => {
        prompted = true;
        return signer.sign(tx);
      } }, options.messageVersion, async () => {
        options.signal?.throwIfAborted();
        validateSellQuote(current, er.control, er.now);
        options.onQuote?.(current);
      });
      if (!options.refreshQuote) validateSellQuote(current, er.control, er.now);
      options.signal?.throwIfAborted();
      return { quote: current, endpoint: er.connection.rpcEndpoint, prepared, refreshQuote: options.refreshQuote };
    } catch (error) {
      if (!options.refreshQuote || prompted || attempt >= 2 || !isQuoteTimingError(error)) throw error;
    }
  }
}

export async function submitQuotedSell(client: SellClient, sell: PreparedSell, signal?: AbortSignal) {
  let er: Awaited<ReturnType<typeof currentPlacement>>;
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        const current = sell.refreshQuote ? await refresh(client, sell.quote, signal) : sell.quote;
        er = await currentPlacement(client, current, signal);
        check(er.connection.rpcEndpoint === sell.endpoint, "Control placement changed after signing");
        break;
      } catch (error) {
        if (!sell.refreshQuote || attempt >= 2 || !isQuoteTimingError(error)) throw error;
      }
    }
  } catch (error) { throw new SellNotSubmittedError(error instanceof Error ? error.message : "Sell validation failed before submission", { cause: error }); }
  return submitTransaction(er.connection, sell.prepared);
}
