import { test } from "node:test";
import assert from "node:assert/strict";
import { SubmissionGate } from "../stack/submission-gate.ts";

test("settlement gate requires distinct signatures for the same receipt", async () => {
  const gate = new SubmissionGate();
  let released = false;
  const first = gate.wait("receipt-a", "signature-a").then(() => { released = true; });
  void gate.wait("receipt-a", "signature-a");
  await Promise.resolve();
  assert.equal(released, false);
  await gate.wait("receipt-a", "signature-b"); await first;
  assert.equal(released, true);
  assert.deepEqual(gate.summary(), [{ receipt: "receipt-a", signatures: ["signature-a", "signature-b"], paired: true }]);
  gate.stop();
});

test("timeout releases a lone settlement but never claims paired overlap", async () => {
  const gate = new SubmissionGate(5);
  await gate.wait("receipt-a", "signature-a");
  await gate.wait("receipt-a", "signature-b");
  assert.equal(gate.summary()[0].paired, false);
  gate.stop();
});

test("shutdown releases every outstanding test request without mixing receipts", async () => {
  const gate = new SubmissionGate();
  const requests = [gate.wait("receipt-a", "signature-a"), gate.wait("receipt-b", "signature-b")];
  gate.stop(); await Promise.all(requests);
  assert(gate.summary().every(batch => !batch.paired));
});
