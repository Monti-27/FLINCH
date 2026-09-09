import assert from "node:assert/strict";
import { open } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import type { Connection, Keypair, TransactionInstruction } from "@solana/web3.js";
import { prepareTransaction, submitTransaction, transactionStatus } from "../../packages/client/src/index.ts";
import type { PreparedTransaction, TransactionSigner } from "../../packages/client/src/index.ts";
import { writePrivate } from "./private-files.ts";
import { networkFailure, readRetry } from "./read-retry.ts";

export const json = (value: unknown) => JSON.stringify(value, (_, item) => typeof item === "bigint" ? item.toString() : item, 2);
export const signerFor = (keys: Keypair[]): TransactionSigner => ({ publicKey: keys[0].publicKey,
  sign: async transaction => { transaction.sign(keys); return transaction; } });

export async function record(directory: string, value: unknown) {
  const file = await open(resolve(directory, "events.jsonl"), "a", 0o600);
  try { await file.writeFile(JSON.stringify({ at: new Date().toISOString(), value }, (_, item) => typeof item === "bigint" ? item.toString() : item) + "\n"); await file.sync(); }
  finally { await file.close(); }
}

export async function waitFor<T>(label: string, read: () => Promise<T | undefined>, signal?: AbortSignal, timeout = 60_000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    signal?.throwIfAborted();
    let value: T | undefined;
    try { value = await read(); }
    catch (error) { if (!networkFailure(error)) throw error; }
    if (value !== undefined) return value;
    await setTimeout(500, undefined, { signal });
  }
  throw new Error(`${label} not confirmed; reconcile retained signatures before retrying`);
}

export async function capture(directory: string, rpc: Connection, signature: string, label: string, signal?: AbortSignal) {
  const transaction = await waitFor(label, async () => await rpc.getTransaction(signature,
    { commitment: "confirmed", maxSupportedTransactionVersion: 0 }) ?? undefined, signal);
  assert.equal(transaction.meta?.err, null);
  await record(directory, { label, endpoint: rpc.rpcEndpoint, signature, transaction });
  return transaction;
}

export async function submitRecorded(directory: string, name: string, rpc: Connection, prepared: PreparedTransaction, signal?: AbortSignal) {
  if (!/^[a-z0-9-]{1,100}$/.test(name)) throw new Error("Invalid operation name");
  signal?.throwIfAborted();
  await writePrivate(resolve(directory, `${name}.submission.json`), json({ name, endpoint: rpc.rpcEndpoint, ...prepared.submission }));
  try { await submitTransaction(rpc, prepared); }
  catch (error) {
    if (!networkFailure(error)) throw error;
    await record(directory, { name, event: "broadcast-response-lost", signature: prepared.submission.signature, failure: networkFailure(error) });
  }
  await waitFor(name, async () => {
    const status = await transactionStatus(rpc, prepared.submission.signature);
    assert.notEqual(status.kind, "failed", "Submitted transaction failed; inspect its signature");
    return status.kind === "confirmed" ? status : undefined;
  }, signal);
  return capture(directory, rpc, prepared.submission.signature, name, signal);
}

export async function sendRecorded(directory: string, name: string, rpc: Connection, instructions: TransactionInstruction[], keys: Keypair[], signal?: AbortSignal) {
  const prepared = await readRetry(() => prepareTransaction(rpc, instructions, signerFor(keys), "legacy", async transaction => {
    const preview = await rpc.simulateTransaction(transaction, { commitment: "confirmed", sigVerify: false });
    if (preview.value.err) {
      await record(directory, { name, preview: preview.value });
      throw new Error("Transaction preview rejected; nothing signed or submitted");
    }
  }), signal);
  return submitRecorded(directory, name, rpc, prepared, signal);
}
