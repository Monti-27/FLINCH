import { test } from "node:test";
import assert from "node:assert/strict";
import { quoteExactInput } from "../../packages/client/src/quotes/curve.ts";
import { allocateQuoteOutput, quoteSell, validateSellQuote } from "../../packages/client/src/quotes/sell.ts";
import type { PoolSnapshot } from "../../packages/client/src/quotes/read.ts";
import { control, snapshot } from "../keeper/fixtures.ts";

const room = snapshot();
const state = { ...control(room), sellers: 0, attempts: [0, 0, 0, 0] as const, nonces: [0n, 0n, 0n, 0n] as const };
const pool: PoolSnapshot = { pool: room.ledger.pool, slot: 50, chainTime: 100n, receivedAtMs: 1000,
  inputReserve: 100_000_000_000n, outputReserve: 20_000_000_000n, tradeFeeRate: 2500n,
  creatorFeeRate: 1000n, protocolFeeRate: 120_000n, fundFeeRate: 40_000n, creatorFeeOnInput: true };

test("integer fees distinguish input creator fees and output creator fees", () => {
  const input = quoteExactInput(pool, 997_501n);
  assert.equal(input.creatorInputFee + input.tradeFee, 3492n);
  assert.equal(input.creatorInputFee, 997n);
  assert.equal(input.tradeFee, 2495n);
  assert.equal(input.protocolFee, 299n);
  assert.equal(input.fundFee, 99n);
  const output = quoteExactInput({ ...pool, creatorFeeOnInput: false }, 997_501n);
  assert.equal(output.tradeFee, 2494n);
  assert.equal(output.creatorInputFee, 0n);
  assert.equal(output.creatorOutputFee, 199n);
  assert(output.output > 0n);
  assert.throws(() => quoteExactInput(pool, 1n), /consumed/);
  assert.throws(() => quoteExactInput({ ...pool, outputReserve: 1n }, 10n), /zero/);
  assert.throws(() => quoteExactInput({ ...pool, tradeFeeRate: 999_999n }, 1_000_000n), /rates/);
  assert.throws(() => quoteExactInput(pool, -1n));
  const large = quoteExactInput({ ...pool, inputReserve: 9_000_000_000_000_000n, outputReserve: 8_000_000_000_000_000n }, 1_000_000_000_000_001n);
  assert(large.output > 700_000_000_000_000n);
});

test("proportional allocation conserves output with stable seat ties", () => {
  assert.deepEqual(allocateQuoteOutput(11n, [1n, 1n, 1n, 0n]), [4n, 4n, 3n, 0n]);
  assert.deepEqual(allocateQuoteOutput(1n, [0n, 1n, 3n, 0n]), [0n, 0n, 1n, 0n]);
  assert.throws(() => allocateQuoteOutput(1n, [-1n, 2n, 0n, 0n]));
  assert.throws(() => allocateQuoteOutput(1n, [0n, 0n, 0n, 0n]));
});

test("quote range covers every possible complete cohort and known pending sellers", () => {
  for (let pending = 0; pending < 15; pending++) {
    for (let seat = 0; seat < 4; seat++) {
      if (pending & (1 << seat)) continue;
      const current = { ...state, sellers: pending };
      const quote = quoteSell(pool, current, seat, 101n, 100, 1000);
      const actual: bigint[] = [];
      for (let sellers = 1; sellers < 16; sellers++) {
        if (!(sellers & (1 << seat)) || (sellers & pending) !== pending) continue;
        const inputs = current.holdings.map((amount, index) => !(sellers & (1 << index)) ? 0n : amount - (sellers === 15 ? 0n : amount * 25n / 10_000n));
        actual.push(allocateQuoteOutput(quoteExactInput(pool, inputs.reduce((a, b) => a + b)).output, inputs)[seat]);
      }
      assert.equal(quote.outputLow, actual.reduce((a, b) => a < b ? a : b));
      assert.equal(quote.outputHigh, actual.reduce((a, b) => a > b ? a : b));
      assert(actual.every(value => value >= quote.minimumOutput));
      assert.equal(quote.penaltyMaximum, (pending | (1 << seat)) === 15 ? 0n : 2500n);
      validateSellQuote(quote, current, 101n, 2999);
    }
  }
});

test("quote invalidates across time, revisions, holdings, membership and nonce changes", () => {
  const quote = quoteSell(pool, state, 0, 101n, 100, 1000);
  assert.throws(() => validateSellQuote(quote, state, 101n, 3000), /expired/);
  assert.throws(() => validateSellQuote(quote, state, 102n, 1000), /closed/);
  assert.throws(() => validateSellQuote(quote, { ...state, revision: 1n }, 101n, 1000), /revision/);
  assert.throws(() => validateSellQuote(quote, { ...state, sellers: 2 }, 101n, 1000), /changed/);
  assert.throws(() => validateSellQuote(quote, { ...state, holdings: [0n, 1n, 1n, 1n] }, 101n, 1000), /changed/);
  assert.throws(() => validateSellQuote(quote, { ...state, nonces: [1n, 0n, 0n, 0n] }, 101n, 1000), /nonce/);
  assert.throws(() => quoteSell(pool, state, 0, 101n, 100, 3000), /stale/);
  assert.throws(() => quoteSell(pool, { ...state, nonces: [(1n << 64n) - 1n, 0n, 0n, 0n] }, 0, 101n, 100, 1000));
  assert.throws(() => quoteSell(pool, { ...state, holdings: [1n, 0n, 0n, 0n] }, 0, 101n, 100, 1000), /final holder/);
  assert.throws(() => quoteSell(pool, { ...state, attempts: [3, 0, 0, 0] }, 0, 101n, 100, 1000), /cannot queue/);
  assert.throws(() => quoteSell(pool, state, 0, 101n, 501, 1000), /Slippage/);
});
