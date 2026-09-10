import { test } from "node:test";
import assert from "node:assert/strict";
import { Keypair } from "@solana/web3.js";
import { claimIx, economicAccounts, executeIx, expireIx, fundAndStart, injectReturnedControlFixture, receiptKey, replaceControlFixture, roomFixture, snapshots } from "./support/room.ts";
import { BN, controlState, data, ledgerState, program, rejects, setTime, success } from "./support/runtime.ts";
import { balance } from "./support/tokens.ts";

test("execution and expiry have disjoint time windows and expiry charges no penalty", async () => {
  const room = await roomFixture();
  await fundAndStart(room);
  await injectReturnedControlFixture(room, 1);
  const execute = await executeIx(room);
  const expire = await expireIx(room);
  rejects(room.svm, [execute], [room.players[0]], "InvalidControl");
  setTime(room.svm, 1_016n);
  rejects(room.svm, [expire], [room.players[0]], "DomainRejected");
  setTime(room.svm, 1_017n);
  rejects(room.svm, [execute], [room.players[0]], "InvalidControl");
  const receipt = receiptKey(room);
  success(room.svm, [expire], [room.players[0]]);
  const state = ledgerState(room.svm, room.ledger).economics!;
  assert.equal(state.revision.toString(), "1");
  assert.deepEqual(state.holdings.map(amount => amount.toString()), Array(4).fill("1000000"));
  assert.equal(balance(room.svm, room.wsolVault), 4_000_000n);
  assert.equal(balance(room.svm, room.usdcVault), 0n);
  assert.equal(program.coder.accounts.decode("batchReceipt", data(room.svm, receipt)).expired, true);
  rejects(room.svm, [expire], [room.players[0]]);
});

test("prepared, stale, mismatched and incorrectly owned control accounts cannot authorize a fill", async () => {
  const room = await roomFixture();
  await fundAndStart(room);
  setTime(room.svm, 1_002n);
  rejects(room.svm, [await executeIx(room)], [room.players[0]], "InvalidControl");
  await injectReturnedControlFixture(room, 1);
  const valid = controlState(room.svm, room.control);
  for (const mutate of [
    (value: typeof valid) => { value.revision = new BN(1); },
    (value: typeof valid) => { value.holdings[0] = new BN(1); },
    (value: typeof valid) => { value.wallets[0] = Keypair.generate().publicKey; },
    (value: typeof valid) => { value.ledger = Keypair.generate().publicKey; },
    (value: typeof valid) => { value.version = 1; },
    (value: typeof valid) => { value.attempts[0] = 4; },
    (value: typeof valid) => { value.nonces[0] = new BN(0); },
    (value: typeof valid) => { value.minimumOutputs[0] = new BN(0); },
  ]) {
    const fresh = controlState(room.svm, room.control);
    mutate(fresh);
    await replaceControlFixture(room, fresh);
    const before = snapshots(room.svm, economicAccounts(room));
    rejects(room.svm, [await executeIx(room, receiptKey(room, fresh.revision))], [room.players[0]]);
    assert.deepEqual(snapshots(room.svm, economicAccounts(room)), before);
    await replaceControlFixture(room, valid);
  }
  const original = room.svm.getAccount(room.control)!;
  room.svm.setAccount(room.control, { ...original, owner: Keypair.generate().publicKey });
  rejects(room.svm, [await executeIx(room)], [room.players[0]], "AccountOwnedByWrongProgram");
});

test("base recovery wins over a late returned batch and preserves earlier sale proceeds", async () => {
  const room = await roomFixture();
  await fundAndStart(room);
  await injectReturnedControlFixture(room, 1);
  setTime(room.svm, 1_002n);
  success(room.svm, [await executeIx(room)], [room.players[0]]);
  success(room.svm, [await claimIx(room, 0, false)], [room.players[0]]);
  await injectReturnedControlFixture(room, 2, undefined, 44);
  const unsold = ledgerState(room.svm, room.ledger).economics!.holdings.map(amount => BigInt(amount.toString()));
  setTime(room.svm, 1_120n);
  success(room.svm, [await program.methods.recoverRound().accountsStrict({ ledger: room.ledger }).instruction()], [room.players[0]]);
  const before = snapshots(room.svm, economicAccounts(room));
  rejects(room.svm, [await executeIx(room)], [room.players[0]], "DomainRejected");
  assert.deepEqual(snapshots(room.svm, economicAccounts(room)), before);
  for (let seat = 1; seat < 4; seat++) {
    const initial = balance(room.svm, room.tokens[seat].wsol);
    success(room.svm, [await claimIx(room, seat, true)], [room.players[seat]]);
    assert.equal(balance(room.svm, room.tokens[seat].wsol) - initial, unsold[seat]);
  }
  assert.equal(balance(room.svm, room.wsolVault), 0n);
});
