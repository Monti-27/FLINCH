import { test } from "node:test";
import type { TestContext } from "node:test";
import assert from "node:assert/strict";
import { FlinchClient } from "../../packages/client/src/client.ts";
import { ClientError } from "../../packages/client/src/errors.ts";
import { DEVNET_GENESIS } from "../../packages/client/src/network.ts";
import { roomFixture } from "../local/support/room.ts";

async function fixture(t: TestContext, genesis: () => Promise<string>) {
  const room = await roomFixture();
  const methods: string[] = [];
  const clock = Buffer.alloc(40);
  clock.writeBigInt64LE(100n, 32);
  const ledger = room.svm.getAccount(room.ledger)!;
  t.mock.method(globalThis, "fetch", async (_input: unknown, init: RequestInit) => {
    assert.equal(init.redirect, "error");
    assert(init.signal instanceof AbortSignal);
    const rpc = JSON.parse(String(init.body));
    methods.push(rpc.method);
    let result: unknown;
    if (rpc.method === "getGenesisHash") result = await genesis();
    else {
      assert.equal(rpc.method, "getMultipleAccounts", "Recovery must never submit a transaction");
      result = { context: { slot: 50 }, value: [
        { data: [Buffer.from(ledger.data).toString("base64"), "base64"], owner: ledger.owner.toBase58(), executable: false, lamports: 1, rentEpoch: 0 },
        null,
        { data: [clock.toString("base64"), "base64"], owner: "Sysvar1111111111111111111111111111111111111", executable: false, lamports: 1, rentEpoch: 0 },
      ] };
    }
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result }), { status: 200 });
  });
  const client = new FlinchClient({ network: "localnet", expectedGenesis: DEVNET_GENESIS, baseUrl: "http://127.0.0.1:8899" },
    { resolve: async () => assert.fail("Funding reads must not resolve an ER") });
  return { client, address: room.ledger, methods };
}

test("the same client recovers after its initial genesis request times out", async t => {
  let attempts = 0;
  const timeout = new DOMException("Signal timed out", "TimeoutError");
  const f = await fixture(t, async () => {
    if (++attempts === 1) throw timeout;
    return DEVNET_GENESIS;
  });
  await assert.rejects(f.client.readRoom(f.address), error => error === timeout);
  assert.deepEqual(f.methods, ["getGenesisHash"]);
  const room = await f.client.readRoom(f.address);
  assert(room.ledger.address.equals(f.address));
  assert.equal(room.slot, 50);
  await f.client.readRoom(f.address, room.slot);
  assert.deepEqual(f.methods, ["getGenesisHash", "getGenesisHash", "getMultipleAccounts", "getMultipleAccounts"]);
});

test("concurrent reads share each verification attempt and retain successful verification", async t => {
  let finish = (_value: string) => {};
  let fail = (_reason: Error) => {};
  let pending = new Promise<string>((resolve, reject) => { finish = resolve; fail = reject; });
  const f = await fixture(t, () => pending);
  const first = Promise.allSettled([f.client.readRoom(f.address), f.client.readRoom(f.address)]);
  const timeout = new DOMException("Signal timed out", "TimeoutError");
  fail(timeout);
  const failed = await first;
  assert(failed.every(result => result.status === "rejected" && result.reason === timeout));
  assert.deepEqual(f.methods, ["getGenesisHash"]);
  pending = new Promise<string>(resolve => { finish = resolve; });
  const recovered = Promise.all([f.client.readRoom(f.address), f.client.readRoom(f.address)]);
  finish(DEVNET_GENESIS);
  const rooms = await recovered;
  assert(rooms.every(room => room.slot === 50));
  await f.client.readRoom(f.address);
  assert.equal(f.methods.filter(method => method === "getGenesisHash").length, 2);
  assert.equal(f.methods.filter(method => method === "getMultipleAccounts").length, 3);
});

test("a sustained outage fails once per caller retry without reading unverified accounts", async t => {
  const offline = new TypeError("fetch failed");
  const f = await fixture(t, async () => { throw offline; });
  for (let attempt = 1; attempt <= 3; attempt++) {
    await assert.rejects(f.client.readRoom(f.address), error => error === offline);
    assert.equal(f.methods.length, attempt);
  }
  assert(f.methods.every(method => method === "getGenesisHash"));
});

test("a wrong genesis remains blocked even if the next response would match", async t => {
  let attempts = 0;
  const f = await fixture(t, async () => ++attempts === 1 ? "another-chain" : DEVNET_GENESIS);
  for (let attempt = 0; attempt < 3; attempt++) {
    await assert.rejects(f.client.readRoom(f.address), error => error instanceof ClientError && error.code === "wrong_network");
  }
  assert.deepEqual(f.methods, ["getGenesisHash"]);
});

test("a wrong genesis after a transient failure also stays blocked", async t => {
  let attempts = 0;
  const f = await fixture(t, async () => {
    if (++attempts === 1) throw new DOMException("Signal timed out", "TimeoutError");
    return "another-chain";
  });
  await assert.rejects(f.client.readRoom(f.address), { name: "TimeoutError" });
  for (let attempt = 0; attempt < 2; attempt++) {
    await assert.rejects(f.client.readRoom(f.address), error => error instanceof ClientError && error.code === "wrong_network");
  }
  assert.deepEqual(f.methods, ["getGenesisHash", "getGenesisHash"]);
});

test("invalid devnet configuration never requests accounts or accepts a different genesis", async t => {
  const fetch = t.mock.method(globalThis, "fetch", async () => assert.fail("Invalid configuration must not fetch"));
  const client = new FlinchClient({ network: "devnet", expectedGenesis: "another-chain", baseUrl: "https://rpc.magicblock.app/devnet" });
  for (let attempt = 0; attempt < 2; attempt++) {
    await assert.rejects(client.readRoom(client.programId), error => error instanceof ClientError && error.code === "wrong_network");
  }
  assert.equal(fetch.mock.callCount(), 0);
});
