import { test } from "node:test";
import assert from "node:assert/strict";
import anchor from "@coral-xyz/anchor";
import { VersionedTransaction } from "@solana/web3.js";
import { RoomWorker } from "../../apps/keeper/src/room-worker.ts";
import { MemoryOperationStore } from "../../apps/keeper/src/store.ts";
import { clientPort, control, operation, signer, snapshot } from "./fixtures.ts";

test("hard recovery supersedes an unknown ER operation without contacting the ER", async () => {
  const { client, state } = clientPort(snapshot(220n));
  client.status = async () => { state.statusReads++; throw new Error("ER offline"); };
  const store = new MemoryOperationStore();
  await store.put(operation(state.room));
  client.base.sendRawTransaction = async bytes => {
    assert.equal((await store.get(state.room.ledger.address.toBase58()))?.action, "recover");
    state.sends++;
    return anchor.utils.bytes.bs58.encode(VersionedTransaction.deserialize(new Uint8Array(bytes)).signatures[0]);
  };
  const event = await new RoomWorker(client, signer, store).tick(state.room.ledger.address);
  assert.equal(event.action, "recover");
  assert.equal(event.kind, "submitted");
  assert.equal(state.statusReads + state.resolves, 0);
  assert.equal(state.sends, 1);
  assert.deepEqual((await store.history(event.room)).map(row => row.status), ["pending", "superseded", "pending"]);
});

test("unknown submission survives restart without signing or sending a second transaction", async () => {
  const { client, state } = clientPort(snapshot(220n));
  const store = new MemoryOperationStore();
  await assert.rejects(new RoomWorker(client, signer, store).tick(state.room.ledger.address), /timeout/);
  assert.equal(state.sends, 1);
  const restart = new RoomWorker(client, { ...signer, sign: async () => { throw new Error("must not sign again"); } }, store);
  assert.equal((await restart.tick(state.room.ledger.address)).kind, "pending");
  assert.equal(state.sends, 1);
  state.status = "confirmed";
  assert.equal((await restart.tick(state.room.ledger.address)).kind, "confirmed");
});

test("journal failure prevents network submission", async () => {
  const { client, state } = clientPort(snapshot(220n));
  const worker = new RoomWorker(client, signer, { get: async () => null, put: async () => { throw new Error("disk unavailable"); } });
  await assert.rejects(worker.tick(state.room.ledger.address), /disk unavailable/);
  assert.equal(state.sends, 0);
});

test("unknown progress is superseded, never presented as signature confirmation", async () => {
  const { client, state } = clientPort(snapshot());
  state.room = { ...state.room, ledger: { ...state.room.ledger, economics: { ...state.room.ledger.economics!, terminalTag: 1 } } };
  const store = new MemoryOperationStore();
  await store.put(operation(state.room));
  assert.equal((await new RoomWorker(client, signer, store).tick(state.room.ledger.address)).kind, "done");
  assert.equal((await store.get(state.room.ledger.address.toBase58()))?.status, "superseded");
  assert.equal(state.statusReads, 0);
});

test("base execution requires independently verified return evidence", async () => {
  const { client, state } = clientPort(snapshot(102n));
  state.room = { ...state.room, control: { kind: "base", value: control(state.room, "frozen") } };
  const event = await new RoomWorker(client, signer, new MemoryOperationStore()).tick(state.room.ledger.address);
  assert.equal(event.kind, "wait");
  assert.equal(state.proofs, 1);
  assert.equal(state.sends, 0);
});

test("one worker serializes duplicate room ticks and honors cancellation", async () => {
  const { client, state } = clientPort(snapshot(220n));
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  client.readRoom = async () => { await gate; return state.room; };
  const worker = new RoomWorker(client, signer, new MemoryOperationStore());
  const first = worker.tick(state.room.ledger.address);
  assert.equal((await worker.tick(state.room.ledger.address)).kind, "busy");
  release();
  await assert.rejects(first, /timeout/);
  await assert.rejects(worker.tick(state.room.ledger.address, AbortSignal.abort()));
  assert.equal(state.sends, 1);
});

test("confirmed base operations set a minimum snapshot slot on restart", async () => {
  const { client, state } = clientPort(snapshot(220n));
  const store = new MemoryOperationStore();
  await store.put(operation(state.room, { action: "recover", runtime: "base", status: "confirmed", confirmationSlot: 70 }));
  client.readRoom = async (_, minimum) => {
    assert.equal(minimum, 70);
    throw new Error("base is behind confirmation");
  };
  await assert.rejects(new RoomWorker(client, signer, store).tick(state.room.ledger.address), /behind confirmation/);
  assert.equal(state.sends, 0);
});

test("an expired unknown fill can only be superseded by expiry, never another trade", async () => {
  const { client, state } = clientPort(snapshot(117n));
  state.room = { ...state.room, control: { kind: "base", value: control(state.room, "frozen") } };
  const store = new MemoryOperationStore();
  await store.put(operation(state.room, { action: "execute", runtime: "base" }));
  client.status = async () => assert.fail("expiry must not wait on the old signature");
  client.returnProof = async () => ({ signature: "1".repeat(64), slot: 49 });
  await assert.rejects(new RoomWorker(client, signer, store).tick(state.room.ledger.address), /timeout/);
  assert.equal((await store.get(state.room.ledger.address.toBase58()))?.action, "expire");
  assert.equal(state.sends, 1);
});
