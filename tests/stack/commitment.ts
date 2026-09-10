import assert from "node:assert/strict";
import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Connection } from "@solana/web3.js";
import { poll } from "./rpc.ts";

export async function observeCommitment(er: Connection, base: Connection, signature: string, directory: string) {
  const scheduled = await poll("scheduled commit", async () => {
    const transaction = await er.getTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
    if (!transaction?.meta) return;
    assert.equal(transaction.meta.err, null);
    const line = transaction.meta.logMessages?.find(line => line.startsWith("ScheduledCommitSent signature: "));
    assert(line, "Freeze transaction did not schedule a commit");
    return line.slice("ScheduledCommitSent signature: ".length);
  });
  const transaction = await poll("completed commit logs", async () => {
    const transaction = await er.getTransaction(scheduled, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
    if (!transaction?.meta) return;
    assert.equal(transaction.meta.err, null);
    return transaction;
  });
  const signatures = transaction.meta!.logMessages?.flatMap(line => {
    const match = /^ScheduledCommitSent signature\[\d+\]: ([1-9A-HJ-NP-Za-km-z]+)$/.exec(line);
    return match ? [match[1]] : [];
  }) ?? [];
  assert(signatures.length > 0, "Commit completion did not include a base signature");
  for (const commitment of signatures) {
    const confirmed = await poll("confirmed base commitment", async () => {
      const tx = await base.getTransaction(commitment, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
      if (!tx?.meta) return;
      assert.equal(tx.meta.err, null);
      return tx;
    });
    appendFileSync(resolve(directory, "commitments.jsonl"), JSON.stringify({ signature, scheduled,
      commitment, transaction: confirmed, observedAt: new Date().toISOString() }) + "\n", { mode: 0o600 });
  }
  return signatures;
}
