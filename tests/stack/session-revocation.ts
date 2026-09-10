import assert from "node:assert/strict";
import { SendTransactionError } from "@solana/web3.js";
import { ClientError, prepareTransaction, submitTransaction, transactionStatus } from "../../packages/client/src/index.ts";
import { startStack } from "./bootstrap.ts";
import { prepareRoom } from "./room.ts";
import { chainTime, poll, send } from "./rpc.ts";
import { journal, result, snapshot } from "./evidence.ts";
import { captureTransaction, keeper, localClient, tick, walletSigner } from "./client.ts";
import { queueQuotedBatch } from "./quoted-batch.ts";
import { claimAll } from "./lifecycle.ts";

const stack = await startStack();
console.log(`Session revocation evidence: ${stack.directory}`);
try {
  const room = await prepareRoom(stack);
  const client = await localClient(stack);
  const current = keeper(client, stack);
  const ready = () => poll("session test verifies current delegation", async () => {
    await tick(current.worker, room.ledger);
    const base = await client.readRoom(room.ledger);
    if (base.control.kind !== "delegated") return;
    try { return await client.resolve(base); } catch (error) {
      if (error instanceof ClientError && error.code === "placement_pending") return;
      throw error;
    }
  });
  const resolveBatch = (revision: bigint) => poll("keeper resolves session-test batch", async () => {
    await tick(current.worker, room.ledger);
    const base = await client.readRoom(room.ledger);
    assert(base.ledger.economics!.revision <= revision);
    return base.ledger.economics!.revision === revision ? base : undefined;
  });

  await ready();
  await queueQuotedBatch(stack, client, room.ledger, [0], [room.session], room.authorization.address);
  const initial = (await client.readRoom(room.ledger)).ledger.economics!;
  const frozen = await poll("return accepted session intent without executing", async () => {
    const base = await client.readRoom(room.ledger);
    if (base.control.kind === "base" && base.control.value.phase === "frozen") return base.control.value;
    await tick(current.worker, room.ledger);
  });
  const deadline = frozen.startedAt + BigInt(frozen.cohortIndex + 1) * 2n + 15n;
  await poll("expire initial session intent without a sale", async () => await chainTime(stack.base) >= deadline ? true : undefined);
  const expired = (await resolveBatch(1n)).ledger.economics!;
  assert.deepEqual(expired.holdings, initial.holdings);
  assert.deepEqual(expired.usdcClaims, initial.usdcClaims);
  assert.equal(expired.receivedUsdc, 0n);

  const er = await ready();
  const instruction = await client.instructions.queue(room.ledger, room.session.publicKey, 0, 2n, 1n, room.authorization.address);
  const before = await prepareTransaction(er.connection, [instruction], walletSigner([room.session]), "legacy");
  const valid = await er.connection.simulateTransaction(before.transaction, { sigVerify: true, commitment: "confirmed" });
  journal(stack.directory, "session-valid-before-revoke", { sessionToken: room.authorization.address.toBase58(), response: valid });
  assert.equal(valid.value.err, null);
  const revokeStarted = Date.now();
  const revokeSignature = await send(stack.base, [room.authorization.revoke], [room.players[0]], stack.directory, "revoke warm ER session on base");
  const baseAbsentAt = Date.now();
  assert.equal(await stack.base.getAccountInfo(room.authorization.address, "confirmed"), null);
  const controlBefore = await snapshot(er.connection, [room.control]);
  const custodyKeys = [room.ledger, room.wsolVault, room.usdcVault, stack.pool.poolWsolVault, stack.pool.poolUsdcVault];
  const custodyBefore = await snapshot(stack.base, custodyKeys);
  const attempted = await prepareTransaction(er.connection, [instruction], walletSigner([room.session]), "legacy");
  const rejection = await poll("revocation becomes visible to the selected ER", async () => {
    const [account, simulation] = await Promise.all([
      er.connection.getAccountInfoAndContext(room.authorization.address, "confirmed"),
      er.connection.simulateTransaction(attempted.transaction, { sigVerify: true, commitment: "confirmed" }),
    ]);
    journal(stack.directory, "revocation-observations", { elapsedSinceBaseConfirmationMs: Date.now() - baseAbsentAt,
      accountSlot: account.context.slot, owner: account.value?.owner.toBase58(), present: account.value !== null, simulation });
    if (!simulation.value.err) return;
    assert.match((simulation.value.logs ?? []).join("\n"), /AccountNotInitialized|AccountOwnedByWrongProgram|Unauthorized/);
    return { simulation, accountPresent: account.value !== null, elapsedSinceBaseConfirmationMs: Date.now() - baseAbsentAt };
  }, 15_000);
  await assert.rejects(submitTransaction(er.connection, attempted), error => {
    if (!(error instanceof SendTransactionError)) return false;
    const failure = rejection.simulation.value.err;
    assert(failure && typeof failure === "object" && "InstructionError" in failure);
    assert(Array.isArray(failure.InstructionError) && failure.InstructionError.length === 2);
    const [index, reason] = failure.InstructionError;
    assert.equal(index, 0);
    assert(reason && typeof reason === "object" && typeof reason.Custom === "number" && Number.isSafeInteger(reason.Custom));
    journal(stack.directory, "revoked-submission", { ...attempted.submission, sendReturnedError: true,
      message: error.transactionError.message, logs: error.transactionError.logs });
    return new RegExp(`custom program error: 0x${reason.Custom.toString(16)}\\b`).test(error.transactionError.message);
  });
  const rejectedStatus = await transactionStatus(er.connection, attempted.submission.signature);
  journal(stack.directory, "revoked-signature-status", rejectedStatus);
  assert.notEqual(rejectedStatus.kind, "confirmed");
  if (rejectedStatus.kind === "failed") {
    const transaction = await poll("revoked transaction failure evidence", async () =>
      await er.connection.getTransaction(attempted.submission.signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 }) ?? undefined);
    assert.deepEqual(transaction.meta?.err, rejection.simulation.value.err);
    journal(stack.directory, "revoked-failed-transaction", { signature: attempted.submission.signature, transaction });
  }
  assert.deepEqual(await snapshot(er.connection, [room.control]), controlBefore);
  assert.deepEqual(await snapshot(stack.base, custodyKeys), custodyBefore);

  await queueQuotedBatch(stack, client, room.ledger, [0], [room.players[0]]);
  const firstSale = (await resolveBatch(2n)).ledger.economics!;
  assert(firstSale.usdcClaims[0] > 0n);
  await ready();
  await queueQuotedBatch(stack, client, room.ledger, [1, 2], [room.players[1], room.players[2]]);
  const terminal = (await resolveBatch(3n)).ledger.economics!;
  assert.equal(terminal.terminalTag, 1);
  assert.equal(terminal.terminalSeat, 3);
  assert.equal((await tick(current.worker, room.ledger))?.kind, "done");
  await claimAll(room);
  const receipts = await client.receipts(await client.readRoom(room.ledger));
  assert.equal(receipts.length, 3);
  const operations = [...new Map((await current.store.history(room.ledger.toBase58())).map(op => [op.signature, op])).values()];
  for (const operation of operations) {
    await captureTransaction(stack, operation.runtime === "er" ? stack.er : stack.base, operation.signature, `session test keeper ${operation.action}`);
    if (operation.returnSignature) await captureTransaction(stack, stack.base, operation.returnSignature, "session test verified return");
  }
  journal(stack.directory, "revocation-summary", { revokeSignature, sessionToken: room.authorization.address.toBase58(),
    baseConfirmationMs: baseAbsentAt - revokeStarted, ...rejection });
  result(stack.directory, { complete: true, environment: "local MagicBlock session revocation", syntheticLiquidity: true,
    controlInjected: false, acceptedSessionIntent: true, expiredBatches: 1, baseRevocationConfirmed: true,
    erRevocationObserved: true, revokedSendRejected: true, rejectedSignatureStatus: rejectedStatus.kind,
    walletFallbackSwapped: true, swaps: 2, claims: 4,
    rejectionObservedMsAfterBaseConfirmation: rejection.elapsedSinceBaseConfirmationMs, ledger: room.ledger.toBase58() });
  console.log("Warm session revoked, ER rejects reuse, wallet completes two swaps and four claims");
} catch (error) {
  result(stack.directory, { complete: false, environment: "local MagicBlock session revocation", error: String(error) });
  throw error;
} finally { await stack.stop(); }
