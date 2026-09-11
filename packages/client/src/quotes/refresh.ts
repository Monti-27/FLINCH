import type { FlinchClient } from "../client.ts";
import { check } from "../errors.ts";
import type { SellQuote } from "./sell.ts";

export async function refreshSellQuote(client: Pick<FlinchClient, "quote">, approved: SellQuote, signal?: AbortSignal): Promise<SellQuote> {
  signal?.throwIfAborted();
  const fresh = await client.quote(approved.ledger, approved.seat, approved.slippageBps, signal);
  signal?.throwIfAborted();
  return preserveSellMinimum(approved, fresh);
}

export function preserveSellMinimum(approved: SellQuote, fresh: SellQuote): SellQuote {
  check(fresh.ledger.equals(approved.ledger) && fresh.pool.equals(approved.pool) && fresh.seat === approved.seat
    && fresh.revision === approved.revision && fresh.nonce === approved.nonce, "Position changed; review a new sell quote");
  check(fresh.sellers === approved.sellers && fresh.holdings.every((value, seat) => value === approved.holdings[seat]),
    "Cohort changed; review a new sell quote");
  check(fresh.slippageBps === approved.slippageBps && fresh.poolSlot >= approved.poolSlot
    && fresh.cohortIndex >= approved.cohortIndex, "Refreshed quote is older than the approved quote");
  check(fresh.outputLow >= approved.minimumOutput, "Price moved below your approved minimum");
  return Object.freeze({ ...fresh, minimumOutput: approved.minimumOutput });
}

export function isQuoteTimingError(error: unknown): boolean {
  return error instanceof Error && /^(Quote expired; refresh before signing|Quote cohort closed|Pool quote is stale)$/.test(error.message);
}
