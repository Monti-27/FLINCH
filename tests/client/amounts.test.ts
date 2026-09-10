import { test } from "node:test";
import assert from "node:assert/strict";
import { parseUnits, formatUnits, encodeU64, U64_MAX } from "../../packages/client/src/amounts.ts";

test("decimal parsing preserves every unit without floating point", () => {
  assert.equal(parseUnits("0.001", 9), 1_000_000n);
  assert.equal(parseUnits("18446744073709.551615", 6), U64_MAX);
  for (const decimals of [0, 6, 9, 18]) {
    for (const amount of [0n, 1n, 100n, 9007199254740993n, U64_MAX]) {
      assert.equal(parseUnits(formatUnits(amount, decimals), decimals), amount);
    }
  }
  assert.deepEqual([...encodeU64(U64_MAX)], Array(8).fill(255));
});

test("ambiguous, negative, excessive-precision and overflowing amounts reject", () => {
  for (const value of ["", " 1", "01", "1e6", ".5", "1.", "-1", "NaN", "0.0000001", "18446744073709.551616"]) {
    assert.throws(() => parseUnits(value, 6));
  }
  assert.throws(() => encodeU64(-1n));
  assert.throws(() => encodeU64(U64_MAX + 1n));
});
