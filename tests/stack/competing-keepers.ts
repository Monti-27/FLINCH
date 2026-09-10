import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Keypair, SystemProgram } from "@solana/web3.js";
import { ClientError, transactionStatus } from "../../packages/client/src/index.ts";
import { FileOperationStore } from "../../apps/keeper/src/index.ts";
import { startStack } from "./bootstrap.ts";
import { prepareRoom } from "./room.ts";
import { poll, send } from "./rpc.ts";
import { journal, result, snapshot } from "./evidence.ts";
import { localClient, sendClient, captureTransaction } from "./client.ts";
import { queueQuotedBatch } from "./quoted-batch.ts";
import { startKeeperProcess } from "./service-process.ts";
import type { KeeperProcess } from "./service-process.ts";
import { SubmissionGate } from "./submission-gate.ts";
import { rpcProxy } from "./rpc-proxy.ts";

const stack = await startStack();
const secrets = await mkdtemp(join(tmpdir(), "flinch-competing-"));
const gate = new SubmissionGate();
const proxy = await rpcProxy(stack.base.rpcEndpoint, stack.directory, async submission => {
  if (submission.action === "execute_batch" && submission.receipt) await gate.wait(submission.receipt, submission.signature);
});
const children: KeeperProcess[] = [];
console.log(`Competing keeper evidence: ${stack.directory}`);
try {
  const payers = [Keypair.generate(), Keypair.generate()];
  await send(stack.base, payers.map(payer => SystemProgram.transfer({ fromPubkey: stack.host.publicKey,
    toPubkey: payer.publicKey, lamports: 100_000_000n })), [stack.host], stack.directory, "fund two independent local keepers");
  const room = await prepareRoom(stack, { start: false });
  const client = await localClient(stack);
  const stores: FileOperationStore[] = [];
  for (const [index, payer] of payers.entries()) {
    const keypairFile = join(secrets, `payer-${index}.json`);
    const configFile = join(secrets, `keeper-${index}.json`);
    const journalDirectory = join(stack.directory, `keeper-${index}`);
    await writeFile(keypairFile, JSON.stringify([...payer.secretKey]), { mode: 0o600 });
    await writeFile(configFile, JSON.stringify({ version: 1, network: "localnet", baseUrl: proxy.url,
      localErUrl: stack.er.rpcEndpoint, expectedGenesis: client.config.expectedGenesis, rooms: [room.ledger.toBase58()],
      keypairFile, payer: payer.publicKey.toBase58(), journalDirectory, messageVersion: "legacy", concurrency: 1 }), { mode: 0o600 });
    stores.push(new FileOperationStore(journalDirectory));
    children.push(startKeeperProcess(configFile, stack.directory));
  }
  await Promise.all(children.map(child => child.ready()));
  for (const [revision, seats] of [[0n, [0]], [1n, [1, 2]]] as const) {
    await poll("two keepers prepare the next ER batch", async () => {
      for (const child of children) assert.equal(child.child.exitCode, null);
      const base = await client.readRoom(room.ledger);
      if (base.control.kind !== "delegated" || base.ledger.economics?.revision !== revision) return;
      try { return await client.resolve(base); } catch (error) {
        if (error instanceof ClientError && error.code === "placement_pending") return;
        throw error;
      }
    });
    const before = (await client.readRoom(room.ledger)).ledger.economics!;
    const wallets = revision === 0n ? [room.session] : seats.map(seat => room.players[seat]);
    const quotes = await queueQuotedBatch(stack, client, room.ledger, [...seats], wallets, revision === 0n ? room.authorization.address : undefined);
    const after = await poll("competing settlement advances exactly one revision", async () => {
      const state = await client.readRoom(room.ledger);
      assert(state.ledger.economics!.revision <= revision + 1n);
      return state.ledger.economics!.revision === revision + 1n ? state : undefined;
    });
    assert(after.ledger.economics!.receivedUsdc > before.receivedUsdc);
    for (const quote of quotes) assert(after.ledger.economics!.usdcClaims[quote.seat] >= quote.minimumOutput);
  }
  await poll("both keepers reconcile terminal ledger", async () => children.every(child =>
    child.events.some(event => event.event === "room" && event.kind === "done")) ? true : undefined);
  await Promise.all(children.map(child => child.stop()));
  for (const child of children) assert.deepEqual(await child.finished, { code: 0, signal: null });
  const races = gate.summary();
  assert.equal(races.length, 2);
  for (const race of races) {
    assert.equal(race.paired, true, "Both signed submissions must wait at the same gate before either reaches Solana");
    assert.equal(race.signatures.length, 2);
    const states = await Promise.all(race.signatures.map(signature => transactionStatus(stack.base, signature)));
    assert.equal(states.filter(state => state.kind === "confirmed").length, 1);
    journal(stack.directory, "settlement-races", { ...race, statuses: states });
    for (const [index, status] of states.entries()) {
      if (status.kind !== "failed") continue;
      const transaction = await poll("failed competing transaction evidence", async () =>
        await stack.base.getTransaction(race.signatures[index], { commitment: "confirmed", maxSupportedTransactionVersion: 0 }) ?? undefined);
      assert.deepEqual(transaction.meta?.err, status.error);
      assert.equal(transaction.meta?.innerInstructions?.length ?? 0, 0);
      assert.deepEqual(transaction.meta?.preTokenBalances, transaction.meta?.postTokenBalances);
      journal(stack.directory, "failed-race-transactions", { signature: race.signatures[index], transaction });
    }
  }
  const terminal = (await client.readRoom(room.ledger)).ledger.economics!;
  assert.equal(terminal.terminalTag, 1); assert.equal(terminal.revision, 2n);
  const receipts = await client.receipts(await client.readRoom(room.ledger));
  assert.equal(receipts.length, 2);
  for (let seat = 0; seat < 4; seat++) {
    const asset = seat === terminal.terminalSeat ? "wsol" : "usdc";
    const destination = room.tokens[seat][asset];
    const before = BigInt((await stack.base.getTokenAccountBalance(destination)).value.amount);
    await sendClient(stack, client.base, [await client.instructions.claim(room.ledger, room.players[seat].publicKey, asset)],
      [room.players[seat]], "claim after competing keepers");
    const after = BigInt((await stack.base.getTokenAccountBalance(destination)).value.amount);
    assert.equal(after - before, asset === "wsol" ? terminal.holdings[seat] : terminal.usdcClaims[seat]);
    journal(stack.directory, "claim-balances", { seat, asset, before: before.toString(), after: after.toString() });
  }
  assert.equal((await stack.base.getTokenAccountBalance(room.wsolVault)).value.amount, "0");
  assert.equal((await stack.base.getTokenAccountBalance(room.usdcVault)).value.amount, "0");
  for (const [index, store] of stores.entries()) {
    const history = await store.history(room.ledger.toBase58());
    assert.notEqual(history.at(-1)?.status, "pending");
    for (const op of [...new Map(history.map(op => [op.signature, op])).values()]) {
      const rpc = op.runtime === "er" ? stack.er : stack.base;
      const status = await transactionStatus(rpc, op.signature);
      if (status.kind === "confirmed") await captureTransaction(stack, rpc, op.signature, `keeper ${index} ${op.action}`);
      else journal(stack.directory, "nonconfirmed-race-operations", { ...op, observedStatus: status });
      if (op.returnSignature) await captureTransaction(stack, stack.base, op.returnSignature, "race verified return");
    }
  }
  journal(stack.directory, "final-state", await snapshot(stack.base, [room.ledger, room.control, room.wsolVault, room.usdcVault]));
  result(stack.directory, { complete: true, environment: "two separate local keeper processes", syntheticLiquidity: true,
    controlInjected: false, independentKeysAndJournals: true, pairedSettlementRaces: 2, swaps: 2, receipts: 2, claims: 4,
    bothKeepersReconciled: true, ledger: room.ledger.toBase58() });
  console.log("Two independent keepers raced both settlements; exactly two swaps and four claims completed");
} catch (error) {
  journal(stack.directory, "race-gate", gate.summary());
  result(stack.directory, { complete: false, environment: "competing keepers", error: String(error) });
  throw error;
} finally {
  gate.stop();
  const stopped = await Promise.allSettled(children.map(child => child.stop()));
  await proxy.stop(); await stack.stop();
  if (stopped.every(value => value.status === "fulfilled")) await rm(secrets, { recursive: true, force: true });
}
