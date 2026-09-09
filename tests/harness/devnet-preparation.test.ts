import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, realpath, rm, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { Keypair, SystemProgram, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { ensureKey, readKey, writePrivate } from "../../tools/devnet/private-files.ts";
import { stageRelease } from "../../tools/devnet/release.ts";
import { hash, matchesBinary } from "../../tools/devnet/program-data.ts";
import { fundingBudget } from "../../tools/devnet/budget.ts";
import { deployDevnet } from "../../tools/devnet/deploy.ts";
import { fundDemo } from "../../tools/devnet/fund.ts";
import { runSoak } from "../../tools/devnet/soak.ts";

test("devnet mutation commands require opt-in before filesystem and network access", async () => {
  await assert.rejects(deployDevnet("not-a-path", false), /execute-devnet/);
  await assert.rejects(fundDemo("not-a-path", false), /execute-devnet/);
  await assert.rejects(runSoak("not-a-path", false), /execute-devnet/);
});

test("private key preparation is stable, validates identity and retains usable signing bytes", async t => {
  const directory = await realpath(await mkdtemp(resolve(tmpdir(), "flinch-devnet-keys-")));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = resolve(directory, "key.json");
  const identity = await ensureKey(path);
  const original = await readFile(path);
  assert((await ensureKey(path)).equals(identity));
  assert.deepEqual(await readFile(path), original);
  const key = await readKey(path, identity);
  const transaction = new VersionedTransaction(new TransactionMessage({ payerKey: identity,
    recentBlockhash: Keypair.generate().publicKey.toBase58(), instructions: [SystemProgram.transfer({ fromPubkey: identity, toPubkey: identity, lamports: 1n })] }).compileToV0Message());
  transaction.sign([key]);
  assert(transaction.signatures[0].some(byte => byte !== 0));
  assert.equal((await stat(path)).mode & 0o777, 0o600);
  await assert.rejects(readKey(path, Keypair.generate().publicKey), /identity differs/);
  await assert.rejects(writePrivate(path, "must not overwrite"));
  assert.deepEqual(await readFile(path), original);
});

test("release staging rejects changed builds and never follows subsequent rebuilds", async t => {
  const directory = await realpath(await mkdtemp(resolve(tmpdir(), "flinch-devnet-release-")));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(resolve(directory, "build"), { mode: 0o700 });
  const bytes = Buffer.from([127, 69, 76, 70, 1, 2, 3]);
  await writePrivate(resolve(directory, "build/flinch_v2.so"), bytes);
  await assert.rejects(stageRelease(directory, { bytes: bytes.length, sha256: "invalid" }), /changed/);
  const staged = await stageRelease(directory, { bytes: bytes.length, sha256: hash(bytes) });
  assert.notEqual(staged, resolve(directory, "build/flinch_v2.so"));
  assert.deepEqual(await readFile(staged), bytes);
  assert(matchesBinary(Buffer.concat([bytes, Buffer.alloc(3)]), bytes));
  assert(!matchesBinary(Buffer.concat([bytes, Buffer.from([1])]), bytes));
  assert(!matchesBinary(bytes.subarray(1), bytes));
});

test("funding budget includes temporary buffer, retained program rent and bounded demo reserves", () => {
  const budget = fundingBudget(613664, { program: 833120n, data: 3118291960n, buffer: 3118251320n });
  assert.equal(budget.total, 7644396400n);
  assert.equal(budget.requested, 8000000000n);
  assert.equal(budget.fourPlayerReserve, 4n * 150000000n);
  assert(budget.requested >= budget.total);
  assert.throws(() => fundingBudget(0, { program: 0n, data: 0n, buffer: 0n }));
});
