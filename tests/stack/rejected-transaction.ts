import assert from "node:assert/strict";
import { SendTransactionError } from "@solana/web3.js";
import type { Connection } from "@solana/web3.js";
import { submitTransaction, transactionStatus } from "../../packages/client/src/index.ts";
import type { PreparedTransaction } from "../../packages/client/src/index.ts";
import { journal } from "./evidence.ts";
import { poll } from "./rpc.ts";

export async function rejectedTransaction(rpc: Connection, prepared: PreparedTransaction, directory: string, label: string,
  expected: RegExp, codes: number[]) {
  let rejected = false;
  try { await submitTransaction(rpc, prepared); } catch (error) {
    assert(error instanceof SendTransactionError);
    journal(directory, "rejected-submissions", { label, ...prepared.submission, error: error.transactionError });
    const match = /custom program error: 0x([0-9a-f]+)\b/i.exec(error.transactionError.message);
    assert(match && codes.includes(Number.parseInt(match[1], 16)), "Unexpected rejection reason");
    rejected = true;
  }
  const state = rejected ? await transactionStatus(rpc, prepared.submission.signature) : await poll("submitted transaction rejects", async () => {
    const state = await transactionStatus(rpc, prepared.submission.signature);
    return state.kind !== "pending" ? state : undefined;
  });
  journal(directory, "rejected-status", { label, signature: prepared.submission.signature, state });
  assert.notEqual(state.kind, "confirmed");
  if (state.kind === "failed") {
    const transaction = await poll("rejected transaction logs", async () =>
      await rpc.getTransaction(prepared.submission.signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 }) ?? undefined);
    assert.deepEqual(transaction.meta?.err, state.error);
    assert.match((transaction.meta?.logMessages ?? []).join("\n"), expected);
    assert.deepEqual(transaction.meta?.preTokenBalances, transaction.meta?.postTokenBalances);
    journal(directory, "rejected-transactions", { label, signature: prepared.submission.signature, transaction });
  }
  return state;
}

export async function rejectSimulation(rpc: Connection, prepared: PreparedTransaction, directory: string, expected: RegExp) {
  const simulation = await rpc.simulateTransaction(prepared.transaction, { commitment: "confirmed", sigVerify: true });
  journal(directory, "rejection-simulations", { ...prepared.submission, simulation });
  assert(simulation.value.err);
  assert.match((simulation.value.logs ?? []).join("\n"), expected);
}
