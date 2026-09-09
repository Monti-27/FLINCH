import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Keypair, SystemProgram } from "@solana/web3.js";
import { ClientError } from "../../packages/client/src/index.ts";
import { FileOperationStore } from "../../apps/keeper/src/index.ts";
import { startStack } from "./bootstrap.ts";
import { prepareRoom } from "./room.ts";
import { poll, send } from "./rpc.ts";
import { journal, result, snapshot } from "./evidence.ts";
import { captureTransaction, localClient, sendClient } from "./client.ts";
import { queueQuotedBatch } from "./quoted-batch.ts";
import { startKeeperProcess } from "./service-process.ts";
import type { KeeperProcess } from "./service-process.ts";

const stack = await startStack();
const secrets = await mkdtemp(join(tmpdir(), "flinch-service-keys-"));
const children: KeeperProcess[] = [];
console.log(`Standalone keeper evidence: ${stack.directory}`);
try {
  const payer = Keypair.generate();
  await send(stack.base, [SystemProgram.transfer({ fromPubkey: stack.host.publicKey, toPubkey: payer.publicKey, lamports: 100_000_000n })],
    [stack.host], stack.directory, "fund separate local keeper payer");
  const room = await prepareRoom(stack, { start: false });
  const client = await localClient(stack);
  const journalDirectory = resolve(stack.directory, "service-journal");
  const keypairFile = join(secrets, "payer.json");
  await writeFile(keypairFile, JSON.stringify([...payer.secretKey]), { mode: 0o600 });
  const config = { version: 1, network: "localnet", expectedGenesis: await stack.base.getGenesisHash(), baseUrl: stack.base.rpcEndpoint,
    localErUrl: stack.er.rpcEndpoint, rooms: process.env.FLINCH_TEST_DISCOVERY === "true" ? [] : [room.ledger.toBase58()],
    discovery: process.env.FLINCH_TEST_DISCOVERY === "true" ? { pool: stack.pool.pool.toBase58(), validator: room.validator.toBase58() } : undefined,
    journalDirectory, keypairFile, payer: payer.publicKey.toBase58(), concurrency: 1 };
  const configFile = join(secrets, "keeper.json");
  const inspectFile = join(secrets, "inspect.json");
  await writeFile(configFile, JSON.stringify(config), { mode: 0o600 });
  await writeFile(inspectFile, JSON.stringify({ ...config, keypairFile: join(secrets, "does-not-exist.json") }), { mode: 0o600 });
  const beforeInspection = await stack.base.getBalance(payer.publicKey, "confirmed");
  const inspect = startKeeperProcess(inspectFile, stack.directory, "inspect");
  children.push(inspect);
  assert.deepEqual(await inspect.finished, { code: 0, signal: null });
  assert(inspect.events.some(event => event.event === "inspection"));
  assert.equal(await stack.base.getBalance(payer.publicKey, "confirmed"), beforeInspection);
  const store = new FileOperationStore(journalDirectory);
  assert.equal(await store.get(room.ledger.toBase58()), null);
  let current = startKeeperProcess(configFile, stack.directory, "run",
    event => event.event === "room" && event.kind === "submitted" && event.action === "execute");
  children.push(current);
  await current.ready();
  const contender = startKeeperProcess(configFile, stack.directory);
  children.push(contender);
  assert.deepEqual(await contender.finished, { code: 1, signal: null });
  assert(contender.events.some(event => event.event === "fatal" && event.code === "journal_locked"));
  let restartedPending = false;
  for (const seats of [[0], [1, 2]]) {
    const before = await poll("keeper starts funded round", async () => {
      const base = await client.readRoom(room.ledger);
      return base.ledger.economics ? base : undefined;
    });
    const revision = before.ledger.economics!.revision;
    await poll("standalone keeper delegates Control", async () => {
      assert.equal(current.child.exitCode, null, JSON.stringify(current.events));
      const base = await client.readRoom(room.ledger);
      if (base.control.kind !== "delegated") return;
      try { return await client.resolve(base); } catch (error) {
        if (error instanceof ClientError && error.code === "placement_pending") return;
        throw error;
      }
    });
    const wallets = seats[0] === 0 ? [room.session] : seats.map(seat => room.players[seat]);
    const quotes = await queueQuotedBatch(stack, client, room.ledger, seats, wallets, seats[0] === 0 ? room.authorization.address : undefined);
    await poll("standalone keeper swaps the batch", async () => {
      const next = await client.readRoom(room.ledger);
      return next.ledger.economics!.revision === revision + 1n ? next : undefined;
    });
    const after = await client.readRoom(room.ledger);
    assert(after.ledger.economics!.receivedUsdc > before.ledger.economics!.receivedUsdc);
    for (const quote of quotes) assert(after.ledger.economics!.usdcClaims[quote.seat] >= quote.minimumOutput);
    journal(stack.directory, "service-batch", { revision: revision.toString(),
      accounts: await snapshot(stack.base, [room.ledger, room.control, room.wsolVault, room.usdcVault]) });
    if (revision === 0n) {
      assert.deepEqual(await current.finished, { code: 0, signal: null });
      const pending = await store.get(room.ledger.toBase58());
      assert.equal(pending?.status, "pending");
      assert.equal(pending?.action, "execute");
      const priorPid = current.child.pid;
      current = startKeeperProcess(configFile, stack.directory);
      children.push(current);
      await current.ready();
      assert.notEqual(current.child.pid, priorPid);
      restartedPending = true;
    }
  }
  await poll("keeper sees terminal base ledger", async () => current.events.some(event => event.event === "room" && event.kind === "done") ? true : undefined);
  await current.stop();
  assert.deepEqual(await current.finished, { code: 0, signal: null });
  const terminal = (await client.readRoom(room.ledger)).ledger.economics!;
  assert.equal(terminal.terminalTag, 1);
  for (let seat = 0; seat < 4; seat++) {
    const asset = seat === terminal.terminalSeat ? "wsol" : "usdc";
    const destination = room.tokens[seat][asset];
    const before = BigInt((await stack.base.getTokenAccountBalance(destination)).value.amount);
    await sendClient(stack, client.base, [await client.instructions.claim(room.ledger, room.players[seat].publicKey, asset)],
      [room.players[seat]], "player claims after standalone keeper settlement");
    const after = BigInt((await stack.base.getTokenAccountBalance(destination)).value.amount);
    assert.equal(after - before, asset === "wsol" ? terminal.holdings[seat] : terminal.usdcClaims[seat]);
    journal(stack.directory, "claim-balances", { seat, asset, before: before.toString(), after: after.toString() });
  }
  assert.equal((await stack.base.getTokenAccountBalance(room.wsolVault)).value.amount, "0");
  assert.equal((await stack.base.getTokenAccountBalance(room.usdcVault)).value.amount, "0");
  const history = await store.history(room.ledger.toBase58());
  const operations = [...new Map(history.map(op => [op.signature, op])).values()];
  assert.equal(operations.filter(op => op.action === "execute").length, 2);
  assert.equal(operations.filter(op => op.action === "start").length, 1);
  assert(history.some(op => op.action === "execute" && op.revision === "0" && op.status === "superseded"));
  for (const op of operations) {
    await captureTransaction(stack, op.runtime === "er" ? stack.er : stack.base, op.signature, `standalone ${op.action}`);
    if (op.returnSignature) await captureTransaction(stack, stack.base, op.returnSignature, "verified base return");
  }
  const outcome = { complete: true, environment: "local standalone keeper process", syntheticLiquidity: true, controlInjected: false,
    swaps: 2, claims: 4, readOnlyInspection: true, duplicateProcessRejected: true, restartedPending,
    independentFeePayer: true, processIds: children.filter(child => child.events.some(event => event.event === "ready")).map(child => child.child.pid),
    automaticDiscovery: process.env.FLINCH_TEST_DISCOVERY === "true",
    ledger: room.ledger.toBase58() };
  result(stack.directory, outcome);
  console.log(JSON.stringify(outcome));
} catch (error) {
  result(stack.directory, { complete: false, environment: "local standalone keeper process", error: String(error) });
  throw error;
} finally {
  await Promise.all(children.map(child => child.stop()));
  await rm(secrets, { recursive: true, force: true });
  await stack.stop();
}
