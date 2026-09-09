import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { Connection, Keypair, PublicKey, SystemProgram, TransactionMessage } from "@solana/web3.js";
import { prepareTransaction } from "../../packages/client/src/transactions.ts";
import { signerFor, submitRecorded, sendRecorded } from "../../tools/devnet/operations.ts";
import { deploymentBuffer } from "../../tools/devnet/program-data.ts";

test("a lost devnet submission response is journaled and cannot cause a repeat send", async t => {
  const directory = await mkdtemp(resolve(tmpdir(), "flinch-recorded-submission-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const wallet = Keypair.generate();
  const base = new Connection("http://127.0.0.1:8899");
  base.getLatestBlockhash = async () => ({ blockhash: Keypair.generate().publicKey.toBase58(), lastValidBlockHeight: 50 });
  let sends = 0;
  base.sendRawTransaction = async () => { sends++; throw new Error("lost response"); };
  const prepared = await prepareTransaction(base, [SystemProgram.transfer({ fromPubkey: wallet.publicKey, toPubkey: wallet.publicKey, lamports: 1n })], signerFor([wallet]));
  await assert.rejects(submitRecorded(directory, "attempt", base, prepared), /lost response/);
  assert.deepEqual(await readdir(directory), ["attempt.submission.json"]);
  await assert.rejects(submitRecorded(directory, "attempt", base, prepared), { code: "EEXIST" });
  assert.equal(sends, 1);
  base.simulateTransaction = async () => ({ context: { slot: 1 }, value: { err: "AccountNotFound", logs: [] } });
  await assert.rejects(sendRecorded(directory, "preview", base,
    [SystemProgram.transfer({ fromPubkey: wallet.publicKey, toPubkey: wallet.publicKey, lamports: 1n })], [wallet]), /preview rejected/);
  assert.equal(sends, 1);
  assert(!(await readdir(directory)).includes("preview.submission.json"));
});

test("deployment resume credits only the exact owned buffer and validates its authority and size", async () => {
  const base = new Connection("http://127.0.0.1:8899");
  const address = Keypair.generate().publicKey;
  const authority = Keypair.generate().publicKey;
  base.getAccountInfo = async () => null;
  assert.equal((await deploymentBuffer(base, address, authority, 10)).funded, 0n);
  const data = Buffer.alloc(47);
  data.writeUInt32LE(1); data[4] = 1; authority.toBuffer().copy(data, 5);
  let info = { data, executable: false, owner: new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111"), lamports: 3000 };
  base.getAccountInfo = async () => info;
  assert.equal((await deploymentBuffer(base, address, authority, 10)).funded, 3000n);
  await assert.rejects(deploymentBuffer(base, address, Keypair.generate().publicKey, 10), /differs/);
  await assert.rejects(deploymentBuffer(base, address, authority, 11), /differs/);
  info = { ...info, owner: SystemProgram.programId };
  await assert.rejects(deploymentBuffer(base, address, authority, 10), /differs/);
});

test("lost broadcast response reconciles the original signature without another send", async t => {
  const directory = await mkdtemp(resolve(tmpdir(), "flinch-broadcast-reconcile-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const wallet = Keypair.generate();
  const base = new Connection("http://127.0.0.1:8899");
  base.getLatestBlockhash = async () => ({ blockhash: Keypair.generate().publicKey.toBase58(), lastValidBlockHeight: 50 });
  let sends = 0;
  base.sendRawTransaction = async () => { sends++; throw new TypeError("fetch failed"); };
  base.getSignatureStatuses = async () => ({ context: { slot: 8 }, value: [{ slot: 8, confirmations: 2, err: null, confirmationStatus: "confirmed" }] });
  const message = new TransactionMessage({ payerKey: wallet.publicKey, recentBlockhash: Keypair.generate().publicKey.toBase58(), instructions: [] }).compileToLegacyMessage();
  base.getTransaction = async () => ({ slot: 8, meta: { err: null, fee: 0, preBalances: [], postBalances: [] }, transaction: { signatures: [], message } });
  const prepared = await prepareTransaction(base, [SystemProgram.transfer({ fromPubkey: wallet.publicKey, toPubkey: wallet.publicKey, lamports: 1n })], signerFor([wallet]));
  await submitRecorded(directory, "attempt", base, prepared);
  assert.equal(sends, 1);
  await assert.rejects(submitRecorded(directory, "attempt", base, prepared), { code: "EEXIST" });
  assert.equal(sends, 1);
});
