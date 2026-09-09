import { assertSellAvailable, validateSellQuote } from "@flinch/client";
import type { BaseRoom, Control, SellQuote } from "@flinch/client";

export function sellState(room: BaseRoom, control: Control | undefined, seat: number, now: bigint, quote?: SellQuote, wallTime = Date.now()) {
  const ended = !!room.ledger.economics?.terminalTag || room.ledger.phase === "cancelled";
  const exited = seat >= 0 && room.ledger.economics?.holdings[seat] === 0n;
  const pending = !!control && seat >= 0 && !!(control.sellers & (1 << seat));
  let unavailable: string | undefined;
  if (ended) unavailable = "Round complete. Claim any remaining tokens with your wallet.";
  else if (exited) unavailable = "Your sale is confirmed on Solana. Claim any available USDC with your wallet.";
  else if (!control) unavailable = "Waiting for verified MagicBlock state. SELL is paused.";
  else if (seat < 0) unavailable = "Only seated wallets can sell in this round.";
  else {
    try { assertSellAvailable(control, seat, now); }
    catch (error) { unavailable = error instanceof Error ? error.message : "SELL is unavailable."; }
  }
  let quoteIssue: string | undefined;
  if (quote && control) {
    try { validateSellQuote(quote, control, now, wallTime); }
    catch (error) { quoteIssue = error instanceof Error ? error.message : "Get a new quote."; }
  }
  return { ended, exited, pending, active: !ended && !exited, available: !unavailable, unavailable,
    fresh: !!quote && !!control && !unavailable && !quoteIssue, quoteIssue };
}
