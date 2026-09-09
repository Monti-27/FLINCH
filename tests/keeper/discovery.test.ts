import { test } from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { DEVNET_PROGRAM_ID } from "../../packages/client/src/program.ts";
import { RoomCatalog } from "../../apps/keeper/src/runtime/discovery.ts";
import { MemoryOperationStore } from "../../apps/keeper/src/store.ts";
import { clientPort, key, snapshot } from "./fixtures.ts";

test("discovery adds validated rooms, preserves known work during outage and removes completed work", async () => {
  const { client, state } = clientPort(snapshot());
  const address = state.room.ledger.address;
  const scope = { pool: state.room.ledger.pool, validator: state.room.ledger.validator };
  const catalog = new RoomCatalog([], { ...client, programId: DEVNET_PROGRAM_ID }, scope, new MemoryOperationStore(), error => { throw error; },
    { discover: async () => [address] });
  assert.deepEqual(catalog.rooms(), []);
  await setImmediate();
  assert.deepEqual(catalog.rooms(), [address]);
  catalog.complete(address.toBase58());
  assert.deepEqual(catalog.rooms(), []);
  await catalog.stop();
  let errors = 0;
  const unavailable = new RoomCatalog([address], { ...client, programId: DEVNET_PROGRAM_ID }, scope, new MemoryOperationStore(), () => { errors++; },
    { discover: async () => { throw new Error("outage"); } });
  unavailable.rooms();
  await setImmediate();
  assert.deepEqual(unavailable.rooms(), [address]);
  assert.equal(errors, 1);
  await unavailable.stop();
});

test("terminal races are ignored and reporter failures propagate without rejected background promises", async () => {
  const { client, state } = clientPort(snapshot());
  state.room = { ...state.room, ledger: { ...state.room.ledger, economics: { ...state.room.ledger.economics!, terminalTag: 2 } } };
  const scope = { pool: state.room.ledger.pool, validator: state.room.ledger.validator };
  const catalog = new RoomCatalog([], { ...client, programId: DEVNET_PROGRAM_ID }, scope, new MemoryOperationStore(), error => { throw error; },
    { discover: async () => [state.room.ledger.address] });
  catalog.rooms();
  await setImmediate();
  assert.deepEqual(catalog.rooms(), []);
  await catalog.stop();
  const fatal = new RoomCatalog([], { ...client, programId: DEVNET_PROGRAM_ID }, scope, new MemoryOperationStore(), () => { throw new Error("reporter failed"); },
    { discover: async () => { throw new Error("RPC failed"); } });
  fatal.rooms();
  await setImmediate();
  assert.throws(fatal.rooms, /reporter failed/);
  await fatal.stop();
});

test("capacity is reported without evicting rooms that still need recovery", async () => {
  const { client, state } = clientPort(snapshot());
  const initial = Array.from({ length: 128 }, key);
  let errors = 0;
  const catalog = new RoomCatalog(initial, { ...client, programId: DEVNET_PROGRAM_ID },
    { pool: state.room.ledger.pool, validator: state.room.ledger.validator }, new MemoryOperationStore(), () => { errors++; },
    { discover: async () => [key()] });
  catalog.rooms();
  await setImmediate();
  assert.deepEqual(catalog.rooms(), initial);
  assert.equal(errors, 1);
  await catalog.stop();
});
