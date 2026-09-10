import assert from "node:assert/strict";
import anchor from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import { DELEGATION_PROGRAM_ID } from "@magicblock-labs/ephemeral-rollups-sdk";
import { ClientError, PROGRAM_ID, prepareTransaction, receiptAddress, recoveryAt, submitTransaction, transactionStatus } from "../../packages/client/src/index.ts";
import idl from "../../packages/client/generated/idl.json" with { type: "json" };
import { program } from "../local/support/runtime.ts";
import { startStack } from "./bootstrap.ts";
import { commitOutage } from "./commit-outage.ts";
import { prepareRoom } from "./room.ts";
import { chainTime, poll } from "./rpc.ts";
import { journal, result, snapshot } from "./evidence.ts";
import { captureTransaction, keeper, localClient, sendClient, tick, walletSigner } from "./client.ts";
import { queueQuotedBatch } from "./quoted-batch.ts";
import { claimAll } from "./lifecycle.ts";
import { rejectSimulation, rejectedTransaction } from "./rejected-transaction.ts";
import { rpcProxy } from "./rpc-proxy.ts";
import { SubmissionGate } from "./submission-gate.ts";

const recovery = process.argv.includes("--recovery");
let transport!: Awaited<ReturnType<typeof commitOutage>>;
const stack = await startStack({ baseTransport: async (upstream, directory) => {
  transport = await commitOutage(upstream, directory);
  return transport;
} });
const gate = new SubmissionGate();
let raceProxy: Awaited<ReturnType<typeof rpcProxy>> | undefined;
console.log(`Delayed handoff evidence: ${stack.directory}`);
try {
  const room = await prepareRoom(stack);
  const client = await localClient(stack);
  const current = keeper(client, stack);
  const ready = () => poll("verified current ER placement", async () => {
    await tick(current.worker, room.ledger);
    const base = await client.readRoom(room.ledger);
    if (base.control.kind !== "delegated") return;
    try { return await client.resolve(base); } catch (error) {
      if (error instanceof ClientError && error.code === "placement_pending") return;
      throw error;
    }
  });
  const settle = (revision: bigint) => poll("batch reaches expected revision", async () => {
    await tick(current.worker, room.ledger);
    const base = await client.readRoom(room.ledger);
    assert(base.ledger.economics!.revision <= revision);
    return base.ledger.economics!.revision === revision ? base : undefined;
  });
  await ready();
  await queueQuotedBatch(stack, client, room.ledger, [0], [room.session], room.authorization.address);
  const first = (await settle(1n)).ledger.economics!;
  assert(first.usdcClaims[0] > 0n);
  assert(first.holdings[1] > 1_000_000n);
  await ready();
  await queueQuotedBatch(stack, client, room.ledger, [1], [room.players[1]]);
  const live = await client.resolve(await client.readRoom(room.ledger));
  const closesAt = live.control.startedAt + BigInt(live.control.cohortIndex + 1) * 2n;
  const deadline = closesAt + 15n;
  const execute = await client.execute(room.ledger, 1n, stack.host.publicKey, room.stack.pool.pool);
  const stale = await prepareTransaction(stack.base, [execute], walletSigner([stack.host]), "legacy");
  journal(stack.directory, "prepared-before-delay", { ...stale.submission, deadline: deadline.toString() });
  transport.arm(room.control);
  await poll("cohort closes before frozen commitment", async () => await chainTime(stack.er) >= closesAt ? true : undefined);
  await sendClient(stack, live.connection, [await client.instructions.freeze(room.ledger, stack.host.publicKey)], [stack.host], "freeze before delayed commitment");
  await poll("committer attempts targeted base write", async () => transport.requests() > 0 ? true : undefined);
  const custodyKeys = [room.ledger, room.wsolVault, room.usdcVault, stack.pool.poolWsolVault, stack.pool.poolUsdcVault];
  const untouched = await snapshot(stack.base, custodyKeys);
  const frozen = program.coder.accounts.decode("roomControl", (await stack.er.getAccountInfo(room.control))!.data);
  assert(frozen.phase.frozen !== undefined);
  journal(stack.directory, "blocked-handoff", { expiresAt: deadline.toString(), recoveryAt: recoveryAt(first).toString(),
    base: untouched, er: await snapshot(stack.er, [room.control]) });
  const target = recovery ? recoveryAt(first) : deadline;
  console.log(recovery ? "Commitment writes blocked; waiting for the real recovery cutoff" : "Commitment writes blocked through batch expiry");
  await poll("base deadline with Control still delegated", async () => {
    assert((await stack.base.getAccountInfo(room.control))?.owner.equals(DELEGATION_PROGRAM_ID));
    return await chainTime(stack.base) >= target ? true : undefined;
  }, 150_000);
  assert.deepEqual(await snapshot(stack.base, custodyKeys), untouched);
  journal(stack.directory, "deadline-observed", { baseTime: (await chainTime(stack.base)).toString(),
    blockedCommitAttempts: transport.requests(), base: await snapshot(stack.base, [...custodyKeys, room.control]) });
  if (recovery) {
    await poll("keeper recovers while commitment transport is unavailable", async () => {
      await tick(current.worker, room.ledger);
      const base = await client.readRoom(room.ledger);
      return base.ledger.economics!.terminalTag !== 0 ? base : undefined;
    });
    const recovered = (await client.readRoom(room.ledger)).ledger.economics!;
    assert.deepEqual(recovered.holdings, first.holdings);
    assert.deepEqual(recovered.usdcClaims, first.usdcClaims);
    assert.equal(recovered.revision, 1n);
    assert((await stack.base.getAccountInfo(room.control))?.owner.equals(DELEGATION_PROGRAM_ID));
    const before = BigInt((await stack.base.getTokenAccountBalance(room.tokens[0].usdc)).value.amount);
    await sendClient(stack, stack.base, [await client.instructions.claim(room.ledger, room.players[0].publicKey, "usdc")],
      [room.players[0]], "claim prior sale while commitment remains blocked");
    const after = BigInt((await stack.base.getTokenAccountBalance(room.tokens[0].usdc)).value.amount);
    assert.equal(after - before, first.usdcClaims[0]);
    journal(stack.directory, "claim-balances", { seat: 0, asset: "usdc", before: before.toString(), after: after.toString(), controlDelegated: true });
  }
  transport.release();
  await poll("delayed actual commitment returns frozen Control", async () => {
    const info = await stack.base.getAccountInfo(room.control);
    if (!info?.owner.equals(PROGRAM_ID)) return;
    const value = program.coder.accounts.decode("roomControl", info.data);
    assert.equal(value.revision.toString(), "1");
    return value.phase.frozen !== undefined ? true : undefined;
  }, 60_000);
  const proof = await client.returnProof(await client.readRoom(room.ledger));
  assert(proof);
  await captureTransaction(stack, stack.base, proof.signature, "confirmed delayed Control return");
  const beforeRejection = await snapshot(stack.base, [...custodyKeys, room.control, receiptAddress(room.ledger, 1n)]);
  journal(stack.directory, "late-return", { proof, baseTime: (await chainTime(stack.base)).toString(), accounts: beforeRejection });
  const invalidControl = idl.errors.find(error => error.name === "InvalidControl")!.code;
  const domainRejected = idl.errors.find(error => error.name === "DomainRejected")!.code;
  if (recovery) {
    const late = await prepareTransaction(stack.base, [execute], walletSigner([stack.host]), "legacy");
    await rejectSimulation(stack.base, late, stack.directory, /round is terminal/);
    await rejectedTransaction(stack.base, late, stack.directory, "late fill after recovery", /DomainRejected/, [domainRejected]);
    assert.deepEqual(await snapshot(stack.base, [...custodyKeys, room.control, receiptAddress(room.ledger, 1n)]), beforeRejection);
    for (const seat of [1, 2, 3]) {
      const before = BigInt((await stack.base.getTokenAccountBalance(room.tokens[seat].wsol)).value.amount);
      await sendClient(stack, stack.base, [await client.instructions.claim(room.ledger, room.players[seat].publicKey, "wsol")],
        [room.players[seat]], "claim retained holder entitlement after delayed return");
      const after = BigInt((await stack.base.getTokenAccountBalance(room.tokens[seat].wsol)).value.amount);
      assert.equal(after - before, first.holdings[seat]);
      journal(stack.directory, "claim-balances", { seat, asset: "wsol", before: before.toString(), after: after.toString() });
    }
  } else {
    assert(await stack.base.getBlockHeight("confirmed") <= stale.submission.lastValidBlockHeight);
    await rejectSimulation(stack.base, stale, stack.directory, /InvalidControl/);
    raceProxy = await rpcProxy(stack.base.rpcEndpoint, stack.directory, async submission => {
      if (["execute_batch", "expire_batch"].includes(submission.action) && submission.receipt) await gate.wait(submission.receipt, submission.signature);
    });
    const race = new Connection(raceProxy.url, "confirmed");
    const expiry = await prepareTransaction(stack.base, [await client.instructions.expire(room.ledger, 1n, stack.host.publicKey)], walletSigner([stack.host]), "legacy");
    await Promise.all([rejectedTransaction(race, stale, stack.directory, "late fill racing expiry", /InvalidControl|ConstraintSeeds/, [invalidControl, anchor.LangErrorCode.ConstraintSeeds]),
      submitTransaction(race, expiry)]);
    await poll("expiry wins the boundary race", async () => {
      const status = await transactionStatus(stack.base, expiry.submission.signature);
      assert.notEqual(status.kind, "failed");
      return status.kind === "confirmed" ? true : undefined;
    });
    const pair = gate.summary();
    assert.equal(pair.length, 1); assert(pair[0].paired); assert.equal(pair[0].signatures.length, 2);
    journal(stack.directory, "expiry-race", pair);
    await captureTransaction(stack, stack.base, expiry.submission.signature, "expiry wins over late fill");
    const expired = (await client.readRoom(room.ledger)).ledger.economics!;
    assert.equal(expired.revision, 2n);
    assert.deepEqual(expired.holdings, first.holdings);
    assert.deepEqual(expired.usdcClaims, first.usdcClaims);
    assert.equal(expired.swappedWsol, first.swappedWsol);
    assert.equal(expired.receivedUsdc, first.receivedUsdc);
    await ready();
    await queueQuotedBatch(stack, client, room.ledger, [1, 2], [room.players[1], room.players[2]]);
    await settle(3n);
    await claimAll(room);
  }
  assert.equal((await stack.base.getTokenAccountBalance(room.wsolVault)).value.amount, "0");
  assert.equal((await stack.base.getTokenAccountBalance(room.usdcVault)).value.amount, "0");
  const receipts = await client.receipts(await client.readRoom(room.ledger));
  assert.equal(receipts.length, recovery ? 1 : 3);
  assert.equal(receipts.filter(receipt => receipt.expired).length, recovery ? 0 : 1);
  journal(stack.directory, "final-state", await snapshot(stack.base, [...custodyKeys, room.control]));
  const operations = [...new Map((await current.store.history(room.ledger.toBase58())).map(op => [op.signature, op])).values()];
  for (const op of operations) {
    await captureTransaction(stack, op.runtime === "er" ? stack.er : stack.base, op.signature, `delayed test keeper ${op.action}`);
    if (op.returnSignature) await captureTransaction(stack, stack.base, op.returnSignature, "earlier verified return");
  }
  result(stack.directory, { complete: true, environment: "local delayed commitment", syntheticLiquidity: true, controlInjected: false,
    recovery, blockedCommitAttempts: transport.requests(), delayedReturnConfirmed: true, lateFillRejected: true,
    swaps: recovery ? 1 : 2, expiredBatches: recovery ? 0 : 1, receipts: receipts.length,
    expiryRacePaired: !recovery, priorProceedsClaimedWhileDelegated: recovery, claims: 4, ledger: room.ledger.toBase58() });
  console.log("Delayed return cannot force a late sale; four exact claims completed");
} catch (error) {
  result(stack.directory, { complete: false, environment: "local delayed commitment", recovery, error: String(error) });
  throw error;
} finally {
  gate.stop(); transport.release();
  try { await raceProxy?.stop(); } finally { await stack.stop(); }
}
