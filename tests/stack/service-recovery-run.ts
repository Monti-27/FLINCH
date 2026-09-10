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
import { erOutage } from "./er-outage.ts";

const stack = await startStack();
const secrets = await mkdtemp(join(tmpdir(), "flinch-recovery-keys-"));
const outage = await erOutage(stack.directory);
const children: KeeperProcess[] = [];
console.log(`Standalone recovery evidence: ${stack.directory}`);
try {
  const payer = Keypair.generate();
  await send(stack.base, [SystemProgram.transfer({ fromPubkey: stack.host.publicKey, toPubkey: payer.publicKey, lamports: 100_000_000n })],
    [stack.host], stack.directory, "fund separate recovery payer");
  const room = await prepareRoom(stack, { start: false });
  const client = await localClient(stack);
  const journalDirectory = resolve(stack.directory, "service-journal");
  const keypairFile = join(secrets, "payer.json");
  await writeFile(keypairFile, JSON.stringify([...payer.secretKey]), { mode: 0o600 });
  const config = { version: 1, network: "localnet", expectedGenesis: await stack.base.getGenesisHash(), baseUrl: stack.base.rpcEndpoint,
    localErUrl: stack.er.rpcEndpoint, rooms: [room.ledger.toBase58()], journalDirectory, keypairFile, payer: payer.publicKey.toBase58() };
  const configFile = join(secrets, "keeper.json");
  await writeFile(configFile, JSON.stringify(config), { mode: 0o600 });
  const beforeOutage = startKeeperProcess(configFile, stack.directory, "run",
    event => event.event === "room" && event.kind === "submitted" && event.action === "delegate");
  children.push(beforeOutage);
  await beforeOutage.ready();
  await poll("keeper starts and delegates before outage", async () => {
    const base = await client.readRoom(room.ledger);
    if (base.control.kind !== "delegated") return;
    try { return await client.resolve(base); } catch (error) {
      if (error instanceof ClientError && error.code === "placement_pending") return;
      throw error;
    }
  });
  assert.deepEqual(await beforeOutage.finished, { code: 0, signal: null });
  await queueQuotedBatch(stack, client, room.ledger, [0], [room.session], room.authorization.address);
  const live = await client.resolve(await client.readRoom(room.ledger));
  assert.equal(live.control.sellers, 1);
  const original = (await client.readRoom(room.ledger)).ledger.economics!;
  await writeFile(configFile, JSON.stringify({ ...config, localErUrl: outage.url }), { mode: 0o600 });
  const recovering = startKeeperProcess(configFile, stack.directory);
  children.push(recovering);
  await recovering.ready();
  await poll("keeper encounters actual ER transport outage", async () => outage.requests() > 0 ? true : undefined);
  console.log("ER transport blocked after an accepted session SELL; waiting for the real onchain recovery cutoff");
  await poll("base recovery without ER", async () => {
    assert.equal(recovering.child.exitCode, null, JSON.stringify(recovering.events));
    return recovering.events.some(event => event.event === "room" && event.kind === "done") ? true : undefined;
  }, 150_000);
  await recovering.stop();
  assert.deepEqual(await recovering.finished, { code: 0, signal: null });
  const terminal = (await client.readRoom(room.ledger)).ledger.economics!;
  assert.notEqual(terminal.terminalTag, 0);
  assert.deepEqual(terminal.holdings, original.holdings);
  assert.equal(terminal.swappedWsol, 0n);
  assert.equal(terminal.receivedUsdc, 0n);
  const store = new FileOperationStore(journalDirectory);
  const operations = [...new Map((await store.history(room.ledger.toBase58())).map(op => [op.signature, op])).values()];
  assert.equal(operations.filter(op => op.action === "recover").length, 1);
  assert.equal(operations.filter(op => op.action === "execute" || op.action === "freeze").length, 0);
  for (let seat = 0; seat < 4; seat++) {
    const destination = room.tokens[seat].wsol;
    const before = BigInt((await stack.base.getTokenAccountBalance(destination)).value.amount);
    await sendClient(stack, client.base, [await client.instructions.claim(room.ledger, room.players[seat].publicKey, "wsol")],
      [room.players[seat]], "claim after unavailable ER recovery");
    const after = BigInt((await stack.base.getTokenAccountBalance(destination)).value.amount);
    assert.equal(after - before, original.holdings[seat]);
    journal(stack.directory, "claim-balances", { seat, asset: "wsol", before: before.toString(), after: after.toString() });
  }
  assert.equal((await stack.base.getTokenAccountBalance(room.wsolVault)).value.amount, "0");
  assert.equal((await stack.base.getTokenAccountBalance(room.usdcVault)).value.amount, "0");
  journal(stack.directory, "recovered-state", { accounts: await snapshot(stack.base, [room.ledger, room.control, room.wsolVault, room.usdcVault]) });
  for (const op of operations) await captureTransaction(stack, stack.base, op.signature, `standalone ${op.action}`);
  const outcome = { complete: true, environment: "local standalone keeper with injected ER HTTP outage", syntheticLiquidity: true,
    controlInjected: false, sessionIntentAccepted: true, erOutageRequests: outage.requests(), swaps: 0, claims: 4,
    unchangedWsol: true, keeperProcessRestart: true, recoveryOnBase: true, ledger: room.ledger.toBase58() };
  result(stack.directory, outcome);
  console.log(JSON.stringify(outcome));
} catch (error) {
  result(stack.directory, { complete: false, environment: "local standalone recovery", error: String(error) });
  throw error;
} finally {
  await Promise.all(children.map(child => child.stop()));
  await outage.stop();
  await rm(secrets, { recursive: true, force: true });
  await stack.stop();
}
