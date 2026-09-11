import type { PublicKey } from "@solana/web3.js";
import type { Control, Seats } from "../model.ts";
import { check } from "../errors.ts";
import { u64 } from "../amounts.ts";
import { quoteExactInput } from "./curve.ts";
import type { PoolSnapshot } from "./read.ts";

export type SellQuote = Readonly<{
  ledger: PublicKey; pool: PublicKey; revision: bigint; seat: number; nonce: bigint; sellers: number;
  cohortIndex: number; holdings: Seats<bigint>; minimumOutput: bigint; outputLow: bigint; outputHigh: bigint;
  penaltyMaximum: bigint; slippageBps: number; poolSlot: number; receivedAtMs: number; expiresAtMs: number;
}>;

export function allocateQuoteOutput(output: bigint, inputs: readonly bigint[]): bigint[] {
  u64(output);
  inputs.forEach(u64);
  const total = inputs.reduce((sum, value) => sum + value, 0n);
  check(inputs.length === 4 && total > 0n, "Invalid quote allocation");
  const result = inputs.map(value => value * output / total);
  const order = inputs.map((value, seat) => ({ seat, remainder: value * output % total }))
    .sort((a, b) => a.remainder === b.remainder ? a.seat - b.seat : a.remainder > b.remainder ? -1 : 1);
  let dust = output - result.reduce((sum, value) => sum + value, 0n);
  for (const item of order) { if (dust === 0n) break; result[item.seat]++; dust--; }
  return result;
}

export function assertSellAvailable(control: Control, seat: number, now: bigint) {
  check(Number.isInteger(seat) && seat >= 0 && seat < 4, "Invalid quote seat");
  check(now < control.startedAt + 90n, "Selling is closed for this round");
  check(control.phase === "live" && now >= control.startedAt, "Room is not accepting sells");
  check(control.holdings[seat] > 0n && control.attempts[seat] < 3 && !(control.sellers & (1 << seat)), "Seat cannot queue a sell");
  const currentCohort = Number((now - control.startedAt) / 2n);
  check(currentCohort >= control.nextCohort && (!control.sellers || currentCohort === control.cohortIndex), "Cohort is returning or closed");
  const holders = control.holdings.reduce((mask, value, index) => value > 0n ? mask | (1 << index) : mask, 0);
  check((holders & (holders - 1)) !== 0, "The final holder cannot sell");
  return { currentCohort, holders };
}

export function quoteSell(pool: PoolSnapshot, control: Control, seat: number, now: bigint, slippageBps = 100, receivedAtMs = Date.now()): SellQuote {
  const { currentCohort, holders } = assertSellAvailable(control, seat, now);
  check(Number.isInteger(slippageBps) && slippageBps >= 0 && slippageBps <= 500, "Slippage must be between 0 and 500 bps");
  check(receivedAtMs >= pool.receivedAtMs && receivedAtMs - pool.receivedAtMs < 2000, "Pool quote is stale");
  const required = control.sellers | (1 << seat);
  const outputs: bigint[] = [];
  for (let mask = 1; mask < 16; mask++) {
    if ((mask & required) !== required || (mask & holders) !== mask) continue;
    const inputs = control.holdings.map((amount, index) => !(mask & (1 << index)) ? 0n : amount - (mask === holders ? 0n : amount * 25n / 10_000n));
    const input = inputs.reduce((sum, value) => sum + value, 0n);
    outputs.push(allocateQuoteOutput(quoteExactInput(pool, input).output, inputs)[seat]);
  }
  check(outputs.length > 0, "No valid cohort quote");
  const outputLow = outputs.reduce((low, value) => value < low ? value : low);
  const outputHigh = outputs.reduce((high, value) => value > high ? value : high);
  const minimumOutput = outputLow * BigInt(10_000 - slippageBps) / 10_000n;
  check(minimumOutput > 0n, "Minimum output rounds to zero");
  return Object.freeze({ ledger: control.ledger, pool: pool.pool, revision: control.revision, seat,
    nonce: u64(control.nonces[seat] + 1n), sellers: control.sellers, cohortIndex: currentCohort,
    holdings: Object.freeze([...control.holdings]) as Seats<bigint>, minimumOutput, outputLow, outputHigh,
    penaltyMaximum: required === holders ? 0n : control.holdings[seat] * 25n / 10_000n,
    slippageBps, poolSlot: pool.slot, receivedAtMs: pool.receivedAtMs, expiresAtMs: pool.receivedAtMs + 2000 });
}

export function validateSellQuote(quote: SellQuote, control: Control, now: bigint, wallTime = Date.now()) {
  check(Number.isInteger(quote.seat) && quote.seat >= 0 && quote.seat < 4 && u64(quote.minimumOutput) > 0n, "Invalid sell quote");
  check(now < control.startedAt + 90n, "Selling is closed for this round");
  check(wallTime >= quote.receivedAtMs && wallTime < quote.expiresAtMs, "Quote expired; refresh before signing");
  check(control.ledger.equals(quote.ledger) && control.revision === quote.revision && control.phase === "live", "Quote belongs to another room revision");
  check(control.sellers === quote.sellers && control.holdings.every((value, index) => value === quote.holdings[index]), "Cohort changed; refresh quote");
  check(control.holdings[quote.seat] > 0n && !(control.sellers & (1 << quote.seat)) && quote.cohortIndex >= control.nextCohort, "Seat or cohort is no longer available");
  check(now >= control.startedAt && now < control.startedAt + 90n && Number((now - control.startedAt) / 2n) === quote.cohortIndex, "Quote cohort closed");
  check(control.nonces[quote.seat] + 1n === quote.nonce && control.attempts[quote.seat] < 3, "Quote nonce or attempt is no longer current");
}
