import { test } from "node:test";
import assert from "node:assert/strict";
import { ClientError } from "../../packages/client/src/index.ts";
import { prepareFresh, preparationFailure } from "../../tools/devnet/sell.ts";
import { reclaimRoom } from "../../tools/devnet/reclaim.ts";
import { PublicKey } from "@solana/web3.js";
import { readRetry, networkFailure } from "../../tools/devnet/read-retry.ts";

test("devnet preparation refreshes only known pre-submission timing failures", async () => {
  let attempts = 0;
  const events: unknown[] = [];
  const result = await prepareFresh(async () => {
    attempts++;
    if (attempts === 1) throw new ClientError("invalid_account", "Quote cohort closed");
    return "prepared but not submitted";
  }, async event => { events.push(event); }, new AbortController().signal);
  assert.equal(result, "prepared but not submitted");
  assert.equal(attempts, 2);
  assert.deepEqual(events, [{ event: "sell-preparation-rejected", attempt: 0, notSubmitted: true, retryable: true,
    code: "invalid_account", reason: "Quote cohort closed" }]);
});

test("devnet preparation does not retry transport uncertainty or permanent validation errors", async () => {
  for (const error of [new Error("secret transport contents"), new ClientError("invalid_account", "wrong authority")]) {
    let attempts = 0;
    await assert.rejects(prepareFresh(async () => { attempts++; throw error; }, async () => undefined, new AbortController().signal));
    assert.equal(attempts, 1);
    assert(!JSON.stringify(preparationFailure(error)).includes(error.message));
  }
  const signal = AbortSignal.abort();
  await assert.rejects(prepareFresh(async () => assert.fail("Aborted preparation must not run"), async () => undefined, signal));
});

test("devnet reclaim requires explicit authorization before any I/O", async () => {
  await assert.rejects(reclaimRoom("/not-read", PublicKey.default, "/not-read", false), /execute-devnet/);
});

test("only bounded read retries accept transient network failures", async () => {
  let calls = 0;
  assert.equal(await readRetry(async () => {
    if (++calls === 1) throw new DOMException("timeout", "TimeoutError");
    return 7;
  }), 7);
  assert.equal(calls, 2);
  assert.deepEqual(networkFailure(new Error("504 Gateway Timeout")), { kind: "http", status: 504 });
  assert.equal(networkFailure(new ClientError("invalid_account", "504")), null);
  assert.equal(networkFailure(new Error("insufficient balance")), null);
});
