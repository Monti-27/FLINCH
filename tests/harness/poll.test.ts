import { test } from "node:test";
import assert from "node:assert/strict";
import { poll } from "../stack/rpc.ts";

test("poll returns observed values including false", async () => {
  assert.equal(await poll("value", async () => false), false);
});

test("poll does not retry permanent failures", async () => {
  let calls = 0;
  await assert.rejects(poll("failure", async () => {
    calls++;
    throw new Error("rejected transaction");
  }), /rejected transaction/);
  assert.equal(calls, 1);
});

test("poll times out absent state and explicitly retryable startup errors", async () => {
  await assert.rejects(poll("missing", async () => undefined, 5), /missing timed out/);
  await assert.rejects(poll("startup", async () => { throw new Error("offline"); }, 5, true), /startup timed out: Error: offline/);
});
