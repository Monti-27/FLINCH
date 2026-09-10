import assert from "node:assert/strict";
import anchor from "@coral-xyz/anchor";
import { setTimeout } from "node:timers/promises";
import { Connection, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import type { Keypair, TransactionInstruction } from "@solana/web3.js";
import { journal, snapshot } from "./evidence.ts";

export async function poll<T>(label: string, read: () => Promise<T | undefined>, timeout = 45_000, retryErrors = false): Promise<T> {
  const end = Date.now() + timeout;
  let last: unknown;
  while (Date.now() < end) {
    try {
      const result = await read();
      if (result !== undefined) return result;
    } catch (error) {
      if (!retryErrors) throw error;
      last = error;
    }
    await setTimeout(Math.min(250, Math.max(0, end - Date.now())));
  }
  throw new Error(`${label} timed out${last ? `: ${String(last)}` : ""}`);
}

export async function send(connection: Connection, instructions: TransactionInstruction[], signers: Keypair[], directory: string, label: string) {
  const latest = await connection.getLatestBlockhash("confirmed");
  const message = new TransactionMessage({ payerKey: signers[0].publicKey, recentBlockhash: latest.blockhash, instructions }).compileToLegacyMessage();
  const tx = new VersionedTransaction(message);
  tx.sign(signers);
  assert(tx.serialize().length <= 1232);
  const signature = anchor.utils.bytes.bs58.encode(Buffer.from(tx.signatures[0]));
  const keys = message.staticAccountKeys.filter((_, i) => message.isAccountWritable(i));
  const before = await snapshot(connection, keys);
  const submittedAt = Date.now();
  const common = { label, endpoint: connection.rpcEndpoint, signature, ...latest };
  journal(directory, "submissions", { ...common, state: "attempting", before });
  try {
    const accepted = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false, preflightCommitment: "confirmed", maxRetries: 5 });
    assert.equal(accepted, signature);
    await poll(label, async () => {
      const status = (await connection.getSignatureStatuses([signature])).value[0];
      if (status?.err) throw new Error(JSON.stringify(status.err));
      if (status && ["confirmed", "finalized"].includes(status.confirmationStatus ?? "")) return status;
      assert(await connection.getBlockHeight("confirmed") <= latest.lastValidBlockHeight, "Transaction blockhash expired; reconcile before retry");
    });
    const transaction = await poll(`${label} logs`, async () => await connection.getTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 }) ?? undefined);
    assert.equal(transaction.meta?.err, null);
    journal(directory, "transactions", { ...common, transaction, before, after: await snapshot(connection, keys), elapsedMs: Date.now() - submittedAt });
  } catch (error) {
    journal(directory, "failures", { ...common, error: String(error),
      logs: "transactionLogs" in Object(error) ? Object(error).transactionLogs : undefined });
    throw error;
  }
  return signature;
}

export async function chainTime(connection: Connection) {
  const clock = await connection.getAccountInfo(new (await import("@solana/web3.js")).PublicKey("SysvarC1ock11111111111111111111111111111111"));
  assert(clock);
  return clock.data.readBigInt64LE(32);
}
