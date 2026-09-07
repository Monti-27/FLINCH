import * as anchor from "@coral-xyz/anchor";
import { Transaction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import type { Connection, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { ClientError, check } from "./errors.ts";
import { withExplicitBudget } from "./transaction-budget.ts";
import { assertMessageUnchanged } from "./transaction-message.ts";

export interface TransactionSigner {
  publicKey: PublicKey;
  sign(transaction: VersionedTransaction): Promise<VersionedTransaction>;
}
export type Submission = Readonly<{ signature: string; blockhash: string; lastValidBlockHeight: number }>;
export type PreparedTransaction = Readonly<{ transaction: VersionedTransaction; submission: Submission }>;
export type TransactionStatus = { kind: "pending" } | { kind: "confirmed"; slot: number } | { kind: "failed"; slot: number; error: unknown };

export function isTransactionSignature(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try { return anchor.utils.bytes.bs58.decode(value).length === 64; } catch { return false; }
}

export async function prepareTransaction(connection: Pick<Connection, "getLatestBlockhash">, instructions: TransactionInstruction[], signer: TransactionSigner, version: "v0" | "legacy" = "v0", beforeSign?: (transaction: VersionedTransaction) => Promise<void>): Promise<PreparedTransaction> {
  check(instructions.length > 0, "Transaction has no instructions");
  const budgeted = withExplicitBudget(instructions);
  const latest = await connection.getLatestBlockhash("confirmed");
  const message = version === "legacy"
    ? new Transaction({ feePayer: signer.publicKey, recentBlockhash: latest.blockhash }).add(...budgeted).compileMessage()
    : new TransactionMessage({ payerKey: signer.publicKey, recentBlockhash: latest.blockhash, instructions: budgeted }).compileToV0Message();
  const transaction = new VersionedTransaction(message);
  checkPacketSize(transaction);
  const expected = transaction.message.serialize();
  await beforeSign?.(transaction);
  assertMessageUnchanged(expected, transaction.message, "Transaction preview");
  const signed = await signer.sign(transaction);
  assertMessageUnchanged(expected, signed.message, "Signer");
  if (signed.signatures.length !== signed.message.header.numRequiredSignatures || signed.signatures.some(signature => signature.length !== 64 || signature.every(byte => byte === 0))) throw new ClientError("invalid_signature", "Transaction is missing a required signature");
  checkPacketSize(signed);
  return { transaction: signed, submission: { ...latest, signature: anchor.utils.bytes.bs58.encode(signed.signatures[0]) } };
}

function checkPacketSize(transaction: VersionedTransaction) {
  let size: number;
  try { size = transaction.serialize().length; }
  catch { throw new ClientError("invalid_account", "Transaction exceeds packet size"); }
  check(size <= 1232, "Transaction exceeds packet size");
}

export async function submitTransaction(connection: Pick<Connection, "sendRawTransaction">, prepared: PreparedTransaction): Promise<string> {
  const signature = await connection.sendRawTransaction(prepared.transaction.serialize(), { skipPreflight: false, preflightCommitment: "confirmed", maxRetries: 5 });
  if (signature !== prepared.submission.signature) throw new ClientError("rpc_error", "RPC returned a different signature");
  return signature;
}

export async function transactionStatus(connection: Pick<Connection, "getSignatureStatuses">, signature: string): Promise<TransactionStatus> {
  const status = (await connection.getSignatureStatuses([signature], { searchTransactionHistory: true })).value[0];
  if (!status || !["confirmed", "finalized"].includes(status.confirmationStatus ?? "")) return { kind: "pending" };
  return status.err ? { kind: "failed", slot: status.slot, error: status.err } : { kind: "confirmed", slot: status.slot };
}
