import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import anchor from "@coral-xyz/anchor";
import { FailedTransactionMetadata, LiteSVM } from "litesvm";
import { Connection, Keypair, PublicKey, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import type { TransactionInstruction } from "@solana/web3.js";
import type { FlinchV2 } from "../../../target/types/flinch_v2.ts";
import type { IdlAccounts } from "@coral-xyz/anchor";
import { observations, recordTransaction } from "./evidence.ts";
import { programAddress, programBinary, programIdl, raydiumBinary, verifyArtifacts } from "./artifacts.ts";

export const { BN } = anchor;
export const PROGRAM_ID = new PublicKey(programAddress);
export const RAYDIUM_ID = new PublicKey("DRaycpLY18LhpbydsBWbVJtxpNv9oXPgjRSfpF2bWpYb");
export const USDC = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
export const idl = JSON.parse(readFileSync(programIdl, "utf8"));
export const program = new anchor.Program<FlinchV2>(idl, { connection: new Connection("http://127.0.0.1:8899") });
export const raydiumIdl = JSON.parse(readFileSync("idls/raydium_cp_swap.json", "utf8"));

export function runtime() {
  const svm = new LiteSVM().withNativeMints();
  verifyArtifacts();
  svm.addProgramFromFile(PROGRAM_ID, programBinary);
  svm.addProgramFromFile(RAYDIUM_ID, raydiumBinary);
  setTime(svm, 1_000n);
  return svm;
}

export function setTime(svm: LiteSVM, timestamp: bigint) {
  const clock = svm.getClock();
  clock.unixTimestamp = timestamp;
  svm.setClock(clock);
}

export function wallet(svm: LiteSVM) {
  const signer = Keypair.generate();
  const result = svm.airdrop(signer.publicKey, 1_000_000_000n);
  assert(!(result instanceof FailedTransactionMetadata));
  return signer;
}

export function submit(svm: LiteSVM, instructions: TransactionInstruction[], signers: Keypair[]) {
  svm.expireBlockhash();
  const message = new TransactionMessage({
    payerKey: signers[0].publicKey,
    recentBlockhash: svm.latestBlockhash(),
    instructions,
  }).compileToV0Message();
  const tx = new VersionedTransaction(message);
  tx.sign(signers);
  assert(tx.serialize().length <= 1232);
  const keys = [...new Map(instructions.flatMap(ix => ix.keys).filter(meta => meta.isWritable)
    .map(meta => [meta.pubkey.toBase58(), meta.pubkey])).values()];
  const before = observations(svm, keys);
  const result = svm.sendTransaction(tx);
  const failed = result instanceof FailedTransactionMetadata;
  recordTransaction(failed ? result.meta() : result, !failed, before, observations(svm, keys));
  return result;
}

export function success(svm: LiteSVM, instructions: TransactionInstruction[], signers: Keypair[]) {
  const result = submit(svm, instructions, signers);
  if (result instanceof FailedTransactionMetadata) {
    assert.fail(result.meta().logs().join("\n"));
  }
  return result;
}

export function rejects(svm: LiteSVM, instructions: TransactionInstruction[], signers: Keypair[], reason?: string) {
  const result = submit(svm, instructions, signers);
  assert(result instanceof FailedTransactionMetadata, "transaction unexpectedly succeeded");
  if (reason) assert(result.meta().logs().some(line => line.includes(reason)), result.meta().logs().join("\n"));
  return result;
}

export function data(svm: LiteSVM, key: PublicKey) {
  const account = svm.getAccount(key);
  assert(account);
  return Buffer.from(account.data);
}

export function ledgerState(svm: LiteSVM, key: PublicKey) {
  return program.coder.accounts.decode<IdlAccounts<FlinchV2>["roomLedger"]>("roomLedger", data(svm, key));
}

export function controlState(svm: LiteSVM, key: PublicKey) {
  return program.coder.accounts.decode<anchor.IdlAccounts<FlinchV2>["roomControl"]>("roomControl", data(svm, key));
}
