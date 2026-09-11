import type { PublicKey } from "@solana/web3.js";
import type { FlinchClient } from "../client.ts";
import { check } from "../errors.ts";
import { prepareTransaction, submitTransaction } from "../transactions.ts";
import type { PreparedTransaction, TransactionSigner } from "../transactions.ts";
import { validateSellQuote } from "./sell.ts";
import type { SellQuote } from "./sell.ts";
import { isQuoteTimingError, preserveSellMinimum } from "./refresh.ts";
import { observationTime } from "./context.ts";

type SellClient = Pick<FlinchClient, "readRoom" | "resolve"> & { instructions: Pick<FlinchClient["instructions"], "queue"> }
  & Partial<Pick<FlinchClient, "quoteContext">>;
export type PreparedSell = Readonly<{ quote: SellQuote; endpoint: string; prepared: PreparedTransaction; refreshQuote?: boolean; sessionToken?: PublicKey }>;
export class SellNotSubmittedError extends Error {}

async function refresh(client: SellClient, quote: SellQuote, signal?: AbortSignal) {
  check(!!client.quoteContext, "Quote refresh is unavailable");
  const context = await client.quoteContext!(quote.ledger, quote.seat, quote.slippageBps, signal);
  signal?.throwIfAborted();
  return { ...context, quote: preserveSellMinimum(quote, context.quote) };
}

async function currentPlacement(client: SellClient, quote: SellQuote, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const room = await client.readRoom(quote.ledger, quote.poolSlot);
  check(room.ledger.pool.equals(quote.pool), "Quote venue differs from room");
  const observedAtMs = Date.now();
  const er = await client.resolve(room, signal);
  validateSellQuote(quote, er.control, observationTime(er.now, observedAtMs));
  signal?.throwIfAborted();
  return { quote, er, observedAtMs };
}

export async function prepareQuotedSell(client: SellClient, quote: SellQuote, signer: TransactionSigner,
  options: { sessionToken?: PublicKey; signal?: AbortSignal; messageVersion?: "v0" | "legacy";
    refreshQuote?: boolean; onQuote?: (quote: SellQuote) => void } = {}): Promise<PreparedSell> {
  for (let attempt = 0; ; attempt++) {
    let prompted = false;
    try {
      const { quote: current, er, observedAtMs } = options.refreshQuote
        ? await refresh(client, quote, options.signal) : await currentPlacement(client, quote, options.signal);
      const expected = options.sessionToken ? er.control.sessionSigners[current.seat] : er.control.wallets[current.seat];
      check(expected.equals(signer.publicKey), "Signer is not authorized for this seat");
      const instruction = await client.instructions.queue(current.ledger, signer.publicKey, current.seat, current.nonce, current.minimumOutput, options.sessionToken ?? null);
      const prepared = await prepareTransaction(er.connection, [instruction], { publicKey: signer.publicKey, sign: tx => {
        prompted = true;
        return signer.sign(tx);
      } }, options.messageVersion, async () => {
        options.signal?.throwIfAborted();
        validateSellQuote(current, er.control, observationTime(er.now, observedAtMs));
        options.onQuote?.(current);
      });
      if (!options.refreshQuote) validateSellQuote(current, er.control, observationTime(er.now, observedAtMs));
      options.signal?.throwIfAborted();
      return { quote: current, endpoint: er.connection.rpcEndpoint, prepared, refreshQuote: options.refreshQuote, sessionToken: options.sessionToken };
    } catch (error) {
      if (!options.refreshQuote || prompted || attempt >= 2 || !isQuoteTimingError(error)) throw error;
    }
  }
}

export async function submitQuotedSell(client: SellClient, sell: PreparedSell, signal?: AbortSignal) {
  let er: Awaited<ReturnType<typeof currentPlacement>>["er"];
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        const context = sell.refreshQuote ? await refresh(client, sell.quote, signal) : await currentPlacement(client, sell.quote, signal);
        er = context.er;
        check(er.connection.rpcEndpoint === sell.endpoint, "Control placement changed after signing");
        const expected = sell.sessionToken ? er.control.sessionSigners[sell.quote.seat] : er.control.wallets[sell.quote.seat];
        check(expected.equals(sell.prepared.transaction.message.staticAccountKeys[0]), "Signer is not authorized for this seat");
        validateSellQuote(context.quote, er.control, observationTime(er.now, context.observedAtMs));
        signal?.throwIfAborted();
        break;
      } catch (error) {
        if (!sell.refreshQuote || attempt >= 2 || !isQuoteTimingError(error)) throw error;
      }
    }
  } catch (error) { throw new SellNotSubmittedError(error instanceof Error ? error.message : "Sell validation failed before submission", { cause: error }); }
  return submitTransaction(er.connection, sell.prepared);
}
