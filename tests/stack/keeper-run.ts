import assert from "node:assert/strict";
import type { PublicKey } from "@solana/web3.js";
import { ClientError } from "../../packages/client/src/index.ts";
import { startStack } from "./bootstrap.ts";
import { prepareRoom } from "./room.ts";
import { poll, chainTime } from "./rpc.ts";
import { journal, result, snapshot } from "./evidence.ts";
import { captureTransaction, keeper, localClient, sendClient, tick } from "./client.ts";
import { queueQuotedBatch } from "./quoted-batch.ts";

const stack = await startStack();
const expiry = process.argv.includes("--expiry");
const quoted = process.argv.includes("--quotes");
let failedRoom: PublicKey[] = [];
console.log(`Client and keeper evidence: ${stack.directory}`);
try {
  const room = await prepareRoom(stack);
  failedRoom = [room.ledger, room.control, room.wsolVault, room.usdcVault];
  const client = await localClient(stack);
  let current = keeper(client, stack);
  let restarts = 0;
  const boundaries = [room.ledger, room.control, room.wsolVault, room.usdcVault, stack.pool.poolWsolVault, stack.pool.poolUsdcVault];
  for (const batch of expiry ? [[0], [1, 2], [1, 2]] : [[0], [1, 2]]) {
    const before = await client.readRoom(room.ledger);
    const revision = before.ledger.economics!.revision;
    const er = await poll("keeper delegates and shared client verifies local placement", async () => {
      const event = await tick(current.worker, room.ledger);
      if (event?.kind === "submitted") {
        current = keeper(client, stack);
        restarts++;
      }
      const base = await client.readRoom(room.ledger);
      if (base.control.kind !== "delegated") return;
      try { return await client.resolve(base); } catch (error) {
        if (error instanceof ClientError && error.code === "placement_pending") return;
        throw error;
      }
    });
    const session = batch[0] === 0;
    const wallets = session ? [room.session] : batch.map(seat => room.players[seat]);
    const nonce = expiry && revision === 2n ? 2n : 1n;
    const quotes = quoted ? await queueQuotedBatch(stack, client, room.ledger, batch, wallets, session ? room.authorization.address : undefined) : [];
    if (!quoted) {
      const queue = await Promise.all(batch.map((seat, i) => client.instructions.queue(room.ledger, wallets[i].publicKey, seat, nonce, 1n,
        session ? room.authorization.address : null)));
      await sendClient(stack, er.connection, queue, wallets, "queue through shared client");
    }
    journal(stack.directory, "batch-snapshots", { stage: "before", revision: revision.toString(), accounts: await snapshot(stack.base, boundaries) });
    const shouldExpire = expiry && revision === 1n;
    if (shouldExpire) {
      const returned = await poll("keeper returns Control before forced expiry", async () => {
        const base = await client.readRoom(room.ledger);
        if (base.control.kind === "base" && base.control.value.phase === "frozen") return base.control.value;
        await tick(current.worker, room.ledger);
      });
      const deadline = returned.startedAt + BigInt(returned.cohortIndex + 1) * 2n + 15n;
      await poll("force expiry by pausing worker", async () => await chainTime(stack.base) >= deadline ? true : undefined);
    }
    await poll("keeper resolves actual batch", async () => {
      const event = await tick(current.worker, room.ledger);
      if (event?.kind === "submitted") { current = keeper(client, stack); restarts++; }
      const base = await client.readRoom(room.ledger);
      return base.ledger.economics!.revision === revision + 1n ? true : undefined;
    });
    const after = await client.readRoom(room.ledger);
    if (shouldExpire) {
      assert.deepEqual(after.ledger.economics!.holdings, before.ledger.economics!.holdings);
      assert.deepEqual(after.ledger.economics!.usdcClaims, before.ledger.economics!.usdcClaims);
    } else {
      assert(after.ledger.economics!.receivedUsdc > before.ledger.economics!.receivedUsdc);
      for (const quote of quotes) assert(after.ledger.economics!.usdcClaims[quote.seat] >= quote.minimumOutput);
    }
    journal(stack.directory, "batch-snapshots", { stage: "after", revision: revision.toString(), accounts: await snapshot(stack.base, boundaries) });
  }
  assert.equal((await tick(current.worker, room.ledger))?.kind, "done");
  const terminal = (await client.readRoom(room.ledger)).ledger.economics!;
  assert.equal(terminal.terminalTag, 1);
  for (let seat = 0; seat < 4; seat++) {
    const asset = seat === terminal.terminalSeat ? "wsol" : "usdc";
    const destination = room.tokens[seat][asset];
    const before = BigInt((await stack.base.getTokenAccountBalance(destination)).value.amount);
    await sendClient(stack, client.base, [await client.instructions.claim(room.ledger, room.players[seat].publicKey, asset)],
      [room.players[seat]], "claim through shared client");
    const after = BigInt((await stack.base.getTokenAccountBalance(destination)).value.amount);
    assert.equal(after - before, asset === "wsol" ? terminal.holdings[seat] : terminal.usdcClaims[seat]);
    journal(stack.directory, "claim-balances", { seat, asset, before: before.toString(), after: after.toString() });
  }
  assert.equal((await stack.base.getTokenAccountBalance(room.wsolVault)).value.amount, "0");
  assert.equal((await stack.base.getTokenAccountBalance(room.usdcVault)).value.amount, "0");
  const operations = [...new Map((await current.store.history(room.ledger.toBase58())).map(op => [op.signature, op])).values()];
  for (const operation of operations) {
    await captureTransaction(stack, operation.runtime === "er" ? stack.er : stack.base, operation.signature, `keeper ${operation.action}`);
    if (operation.returnSignature) await captureTransaction(stack, stack.base, operation.returnSignature, "verified Control return");
  }
  const outcome = { complete: true, environment: "local MagicBlock client and keeper", controlInjected: false, syntheticLiquidity: true,
    swaps: 2, quoteBacked: quoted, expiredBatches: expiry ? 1 : 0, claims: 4, keeperRestarts: restarts, ledger: room.ledger.toBase58() };
  result(stack.directory, outcome);
  console.log(JSON.stringify(outcome));
} catch (error) {
  journal(stack.directory, "keeper-failure", { error: String(error), logs: "transactionLogs" in Object(error) ? Object(error).transactionLogs : undefined });
  if (failedRoom.length) journal(stack.directory, "failure-accounts", { base: await snapshot(stack.base, failedRoom), er: await snapshot(stack.er, failedRoom) });
  result(stack.directory, { complete: false, environment: "local MagicBlock client and keeper", error: String(error) });
  throw error;
} finally { await stack.stop(); }
