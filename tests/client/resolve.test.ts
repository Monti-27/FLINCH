import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { Connection, Keypair } from "@solana/web3.js";
import { DELEGATION_PROGRAM_ID } from "@magicblock-labs/ephemeral-rollups-sdk";
import { FlinchClient } from "../../packages/client/src/client.ts";
import { resolveRoom } from "../../packages/client/src/routing/resolve.ts";
import { snapshot } from "../keeper/fixtures.ts";

test("local clients require explicit placement and pending endpoints are revalidated", async t => {
  assert.throws(() => new FlinchClient({ network: "localnet", baseUrl: "http://127.0.0.1:1", expectedGenesis: "local" }), /explicit/);
  const genesis = Keypair.generate().publicKey.toBase58();
  const server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    const rpc = JSON.parse(body);
    assert.equal(rpc.method, "getGenesisHash");
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result: genesis }));
  });
  server.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  const address = server.address();
  assert(address && typeof address !== "string");
  const client = new FlinchClient({ network: "localnet", expectedGenesis: genesis, baseUrl: `http://127.0.0.1:${address.port}` },
    { resolve: async () => assert.fail("unexpected route") });
  await assert.rejects(client.status("er", "https://attacker.example/", "signature"), /policy/);
  await assert.rejects(client.status("base", "http://127.0.0.1:1", "signature"), /differs/);
});

test("routing rejects newer placement and wrong actual ER identity before reading Control", async t => {
  const room = snapshot();
  let wrongIdentity = true;
  const server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    const rpc = JSON.parse(body);
    assert.equal(rpc.method, "getIdentity");
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result: { identity: wrongIdentity ? Keypair.generate().publicKey.toBase58() : room.ledger.validator.toBase58() } }));
  });
  server.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  const address = server.address();
  assert(address && typeof address !== "string");
  const placement = { endpoint: `http://127.0.0.1:${address.port}`, validator: room.ledger.validator, delegationSlot: room.slot + 1 };
  const resolver = { resolve: async () => placement };
  await assert.rejects(resolveRoom(room, resolver, () => assert.fail("snapshot too old")), /predates/);
  placement.delegationSlot = room.slot;
  await assert.rejects(resolveRoom(room, resolver, url => new Connection(url)), /identity differs/);
  wrongIdentity = false;
  const rpc = new Connection(placement.endpoint);
  rpc.getMultipleAccountsInfoAndContext = async () => ({ context: { slot: 1 }, value: [{ data: Buffer.alloc(1), owner: DELEGATION_PROGRAM_ID, executable: false, lamports: 1 }, null] });
  await assert.rejects(resolveRoom(room, resolver, () => rpc), /handoff/);
});

test("a local record observation is not misreported as a new delegation slot", async () => {
  const room = snapshot();
  const placement = { endpoint: "http://127.0.0.1:17799", validator: room.ledger.validator, observedSlot: room.slot + 1 };
  const resolver = { resolve: async () => placement };
  const reachedEr = new Error("base refreshed before ER resolution");
  let floor = 0;
  await assert.rejects(resolveRoom(room, resolver, () => { throw reachedEr; }, undefined, async minSlot => {
    floor = minSlot;
    return { ...room, slot: minSlot };
  }), error => error === reachedEr);
  assert.equal(floor, placement.observedSlot);
  await assert.rejects(resolveRoom(room, resolver, () => assert.fail("stale base must not resolve"), undefined, async () => room), /stale/);
  await assert.rejects(resolveRoom(room, resolver, () => assert.fail("returning Control must not resolve"), undefined,
    async minSlot => ({ ...room, slot: minSlot, control: { kind: "missing" } })), /placement changed/);
});
