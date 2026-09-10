import { test } from "node:test";
import assert from "node:assert/strict";
import { claimIx, economicAccounts, executeIx, fundAndStart, injectReturnedControlFixture, receiptKey, roomFixture, snapshots } from "./support/room.ts";
import { data, ledgerState, program, rejects, setTime, success } from "./support/runtime.ts";
import { balance } from "./support/tokens.ts";

test("three PDA-signed Raydium exits pay real local USDC and leave the final holder WSOL", async () => {
  const room = await roomFixture();
  await fundAndStart(room);
  let swapped = 0n;
  let received = 0n;
  for (let seat = 0; seat < 3; seat++) {
    const previous = ledgerState(room.svm, room.ledger).economics!;
    await injectReturnedControlFixture(room, 1 << seat);
    setTime(room.svm, 1_002n + BigInt(previous.nextCohort) * 2n);
    const receipt = receiptKey(room);
    const beforeWsol = balance(room.svm, room.wsolVault);
    const beforeUsdc = balance(room.svm, room.usdcVault);
    const beforePool = balance(room.svm, room.pool.poolUsdcVault);
    const execute = await executeIx(room, receipt);
    const result = success(room.svm, [execute], [room.players[0]]);
    assert(result.logs().some(log => log.includes("Instruction: SwapBaseInput")));
    assert.equal(result.signature().length, 64);
    const input = beforeWsol - balance(room.svm, room.wsolVault);
    const output = balance(room.svm, room.usdcVault) - beforeUsdc;
    assert(output > 0n);
    assert.equal(beforePool - balance(room.svm, room.pool.poolUsdcVault), output);
    const recorded = program.coder.accounts.decode("batchReceipt", data(room.svm, receipt));
    assert.equal(recorded.input.toString(), input.toString());
    assert.equal(recorded.output.toString(), output.toString());
    swapped += input;
    received += output;
    const post = snapshots(room.svm, economicAccounts(room));
    rejects(room.svm, [execute], [room.players[0]]);
    assert.deepEqual(snapshots(room.svm, economicAccounts(room)), post);
    const claim = await claimIx(room, seat, false);
    success(room.svm, [claim], [room.players[seat]]);
    assert.equal(balance(room.svm, room.tokens[seat].usdc), output);
    rejects(room.svm, [claim], [room.players[seat]], "DomainRejected");
  }
  const final = ledgerState(room.svm, room.ledger).economics!;
  assert.equal(final.terminalTag, 1);
  assert.equal(final.terminalSeat, 3);
  const winnerAmount = BigInt(final.holdings[3].toString());
  assert(winnerAmount > room.stake);
  success(room.svm, [await claimIx(room, 3, true)], [room.players[3]]);
  assert.equal(swapped + winnerAmount, room.stake * 4n);
  assert.equal(received, room.tokens.reduce((sum, token) => sum + balance(room.svm, token.usdc), 0n));
  assert.equal(balance(room.svm, room.wsolVault), 0n);
  assert.equal(balance(room.svm, room.usdcVault), 0n);
});

test("an individual minimum rolls back a successful Raydium CPI and the receipt", async () => {
  const room = await roomFixture();
  await fundAndStart(room);
  await injectReturnedControlFixture(room, 3, [300_000n, 1n, 0n, 0n]);
  setTime(room.svm, 1_002n);
  const accounts = economicAccounts(room);
  const before = snapshots(room.svm, accounts);
  const receipt = receiptKey(room);
  const failure = rejects(room.svm, [await executeIx(room)], [room.players[0]], "allocated output is below a seller minimum");
  assert(failure.meta().logs().some(log => log.includes("Program DRaycpLY18LhpbydsBWbVJtxpNv9oXPgjRSfpF2bWpYb success")));
  assert.deepEqual(snapshots(room.svm, accounts), before);
  assert.equal(room.svm.getAccount(receipt), null);
});

test("the venue's aggregate slippage failure also preserves every entitlement", async () => {
  const room = await roomFixture();
  await fundAndStart(room);
  await injectReturnedControlFixture(room, 1, [10_000_000n, 0n, 0n, 0n]);
  setTime(room.svm, 1_002n);
  const before = snapshots(room.svm, economicAccounts(room));
  rejects(room.svm, [await executeIx(room)], [room.players[0]], "ExceededSlippage");
  assert.deepEqual(snapshots(room.svm, economicAccounts(room)), before);
});

test("an all-sell batch spends the full WSOL without a holder penalty", async () => {
  const room = await roomFixture();
  await fundAndStart(room);
  await injectReturnedControlFixture(room, 15);
  setTime(room.svm, 1_002n);
  success(room.svm, [await executeIx(room)], [room.players[0]]);
  const state = ledgerState(room.svm, room.ledger).economics!;
  assert.equal(state.terminalTag, 2);
  assert.equal(state.swappedWsol.toString(), (room.stake * 4n).toString());
  const claims = state.usdcClaims.map(amount => BigInt(amount.toString()));
  assert(claims.every(amount => amount > 0n));
  assert(claims[0] - claims[3] <= 1n);
  for (let seat = 0; seat < 4; seat++) success(room.svm, [await claimIx(room, seat, false)], [room.players[seat]]);
  assert.equal(balance(room.svm, room.usdcVault), 0n);
  assert.equal(balance(room.svm, room.wsolVault), 0n);
});
