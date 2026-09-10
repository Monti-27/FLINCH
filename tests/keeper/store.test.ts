import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileOperationStore } from "../../apps/keeper/src/file-store.ts";
import { validateOperation } from "../../apps/keeper/src/operation.ts";
import { RoomWorker } from "../../apps/keeper/src/room-worker.ts";
import { clientPort, operation, signer, snapshot } from "./fixtures.ts";

test("atomic owner-only journal survives restart and retains superseded evidence", async t => {
  const directory = await mkdtemp(join(tmpdir(), "flinch-store-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = new FileOperationStore(directory);
  const op = operation(snapshot());
  assert.equal(await store.get(op.room), null);
  await store.put(op);
  const restart = new FileOperationStore(directory);
  assert.deepEqual(await restart.get(op.room), op);
  await restart.put({ ...op, status: "superseded" });
  assert.equal((await store.history(op.room)).length, 2);
  assert.equal((await stat(join(directory, `${op.room}.json`))).mode & 0o777, 0o600);
  assert.deepEqual(await readdir(directory), [`${op.room}.json`]);
  assert(!/secret|private|signedBytes/.test(await readFile(join(directory, `${op.room}.json`), "utf8")));
});

test("disk-backed worker restart does not retry an uncertain network write", async t => {
  const directory = await mkdtemp(join(tmpdir(), "flinch-restart-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const { client, state } = clientPort(snapshot(220n));
  await assert.rejects(new RoomWorker(client, signer, new FileOperationStore(directory)).tick(state.room.ledger.address), /timeout/);
  const restart = new RoomWorker(client, signer, new FileOperationStore(directory));
  assert.equal((await restart.tick(state.room.ledger.address)).kind, "pending");
  assert.equal(state.sends, 1);
});

test("journal validates decoded signature lengths, u64 revisions and known public fields", () => {
  const op = operation(snapshot());
  assert.equal(validateOperation({ ...op, signature: "1".repeat(64) }, op.room).signature.length, 64);
  for (const change of [{ signature: "1".repeat(63) }, { returnSignature: "invalid" }, { revision: (1n << 64n).toString() },
    { revision: "00" }, { observedSlot: -1 }, { runtime: "base" }, { privateKey: [1, 2, 3] }, { endpoint: "https://example.com/?secret=hidden" }]) {
    assert.throws(() => validateOperation({ ...op, ...change }, op.room));
  }
});

test("same store serializes writes and rejects replacing unknown operations or changing their identity", async t => {
  const directory = await mkdtemp(join(tmpdir(), "flinch-serial-store-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = new FileOperationStore(directory);
  const op = operation(snapshot());
  await Promise.all([store.put(op), store.put({ ...op, status: "confirmed" })]);
  assert.equal((await store.get(op.room))?.status, "confirmed");
  await assert.rejects(store.put({ ...op, status: "pending" }), /resolved/);
  await assert.rejects(store.put({ ...op, revision: "1", status: "confirmed" }), /identity/);
  const next = { ...op, signature: "1".repeat(64) };
  await store.put(next);
  await assert.rejects(store.put(op), /uncertain/);
});
