import { test } from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Keypair, SystemProgram } from "@solana/web3.js";
import { prepareTransaction } from "../../packages/client/src/index.ts";
import { acquireJournal } from "../../apps/keeper/src/runtime/lease.ts";
import { readBoundedFile } from "../../apps/keeper/src/runtime/files.ts";
import { loadSigner } from "../../apps/keeper/src/runtime/signer.ts";
import { FileOperationStore } from "../../apps/keeper/src/file-store.ts";
import { key, operation, snapshot } from "./fixtures.ts";

test("owner-only signing key validates identity and signs without changing the message", async t => {
  const directory = await mkdtemp(join(tmpdir(), "flinch-key-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "payer.json");
  const wallet = Keypair.generate();
  await writeFile(path, JSON.stringify([...wallet.secretKey]), { mode: 0o600 });
  const signer = await loadSigner(path, wallet.publicKey);
  const prepared = await prepareTransaction({ getLatestBlockhash: async () => ({ blockhash: key().toBase58(), lastValidBlockHeight: 50 }) },
    [SystemProgram.transfer({ fromPubkey: wallet.publicKey, toPubkey: key(), lamports: 0 })], signer);
  const signature = prepared.transaction.signatures[0].slice();
  prepared.transaction.sign([wallet]);
  assert.deepEqual(signature, prepared.transaction.signatures[0]);
  await assert.rejects(loadSigner(path, key()), { message: "invalid_keypair" });
  await chmod(path, 0o644);
  await assert.rejects(loadSigner(path, wallet.publicKey), { message: "unsafe_file" });
  await chmod(path, 0o600);
  const linked = join(directory, "linked.json");
  await symlink(path, linked);
  await assert.rejects(loadSigner(linked, wallet.publicKey));
  await writeFile(path, "[999]");
  await assert.rejects(loadSigner(path, wallet.publicKey), { message: "invalid_keypair" });
  await assert.rejects(loadSigner(resolve("package.json"), wallet.publicKey), { message: "unsafe_file" });
});

test("bounded files reject non-files and excess bytes", async t => {
  const directory = await mkdtemp(join(tmpdir(), "flinch-bounded-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "data.json");
  await writeFile(path, "12345", { mode: 0o600 });
  assert.equal((await readBoundedFile(path, 5)).toString(), "12345");
  await assert.rejects(readBoundedFile(path, 4), { message: "unsafe_file" });
  await assert.rejects(readBoundedFile(directory, 4096), { message: "unsafe_file" });
});

test("journal ownership excludes a second process and survives deliberate graceful restart", async t => {
  const directory = await mkdtemp(join(tmpdir(), "flinch-lock-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const release = await acquireJournal(directory);
  await assert.rejects(acquireJournal(directory), { message: "journal_locked" });
  assert.equal(JSON.parse(await readFile(join(directory, "keeper.lock"), "utf8")).pid, process.pid);
  await release();
  await release();
  await (await acquireJournal(directory))();
  await writeFile(join(directory, "keeper.lock"), JSON.stringify({ version: 1, pid: 2_000_000_000 }), { mode: 0o600 });
  await assert.rejects(acquireJournal(directory), { message: "journal_locked" });
});

test("journal directories and records reject links and non-private permissions", async t => {
  const directory = await mkdtemp(join(tmpdir(), "flinch-journal-safety-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const link = join(directory, "link");
  await symlink(directory, link);
  await assert.rejects(acquireJournal(link), { message: "unsafe_file" });
  await chmod(directory, 0o755);
  await assert.rejects(acquireJournal(directory), { message: "unsafe_file" });
  await chmod(directory, 0o700);
  const op = operation(snapshot());
  const store = new FileOperationStore(directory);
  await store.put(op);
  const path = join(directory, `${op.room}.json`);
  await chmod(path, 0o644);
  await assert.rejects(store.get(op.room), /Unsafe operation journal/);
  await rm(path);
  await symlink(join(directory, "missing"), path);
  await assert.rejects(store.get(op.room));
});
