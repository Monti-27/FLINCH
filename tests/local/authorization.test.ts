import { test } from "node:test";
import assert from "node:assert/strict";
import { AccountLayout, NATIVE_MINT, createTransferCheckedInstruction } from "@solana/spl-token";
import { Keypair, SystemProgram } from "@solana/web3.js";
import { claimIx, economicAccounts, executeIx, fundAndStart, injectReturnedControlFixture, joinIx, roomFixture, snapshots } from "./support/room.ts";
import { data, ledgerState, program, rejects, setTime, success, wallet } from "./support/runtime.ts";
import { seedPoolFixture } from "./support/pool.ts";
import { balance } from "./support/tokens.ts";

test("a non-signer cannot fund another wallet's seat", async () => {
  const room = await roomFixture();
  const attacker = wallet(room.svm);
  const ix = await joinIx(room, 0);
  ix.keys = ix.keys.map(meta => meta.pubkey.equals(room.players[0].publicKey) ? { ...meta, isSigner: false } : meta);
  const before = snapshots(room.svm, [room.ledger, room.wsolVault, room.tokens[0].wsol]);
  rejects(room.svm, [ix], [attacker], "AccountNotSigner");
  assert.deepEqual(snapshots(room.svm, [room.ledger, room.wsolVault, room.tokens[0].wsol]), before);
});

test("a swap cannot substitute another pool, vault, config, program or receipt", async () => {
  const room = await roomFixture();
  await fundAndStart(room);
  await injectReturnedControlFixture(room, 1);
  setTime(room.svm, 1_002n);
  const otherPool = await seedPoolFixture(room.svm);
  const before = snapshots(room.svm, economicAccounts(room));
  const replacements = [
    [room.pool.pool, otherPool.pool],
    [room.pool.ammConfig, otherPool.ammConfig],
    [room.pool.poolWsolVault, otherPool.poolWsolVault],
    [room.pool.observation, otherPool.observation],
    [room.pool.authority, room.players[0].publicKey],
  ];
  for (const [original, replacement] of replacements) {
    const ix = await executeIx(room);
    ix.keys = ix.keys.map(meta => meta.pubkey.equals(original) ? { ...meta, pubkey: replacement } : meta);
    rejects(room.svm, [ix], [room.players[0]]);
    assert.deepEqual(snapshots(room.svm, economicAccounts(room)), before);
  }
  const programSwap = await executeIx(room);
  programSwap.keys = programSwap.keys.map(meta => meta.pubkey.toBase58() === "DRaycpLY18LhpbydsBWbVJtxpNv9oXPgjRSfpF2bWpYb"
    ? { ...meta, pubkey: SystemProgram.programId } : meta);
  rejects(room.svm, [programSwap], [room.players[0]]);
  rejects(room.svm, [await executeIx(room, Keypair.generate().publicKey)], [room.players[0]]);
  assert.deepEqual(snapshots(room.svm, economicAccounts(room)), before);
});

test("a failed token claim cannot consume the ledger entitlement", async () => {
  const room = await roomFixture();
  await fundAndStart(room);
  await injectReturnedControlFixture(room, 1);
  setTime(room.svm, 1_002n);
  success(room.svm, [await executeIx(room)], [room.players[0]]);
  const original = room.svm.getAccount(room.tokens[0].usdc)!;
  const frozen = Buffer.from(original.data);
  const token = AccountLayout.decode(frozen);
  AccountLayout.encode({ ...token, state: 2 }, frozen);
  room.svm.setAccount(room.tokens[0].usdc, { ...original, data: frozen });
  const before = snapshots(room.svm, [room.ledger, room.usdcVault, room.tokens[0].usdc]);
  rejects(room.svm, [await claimIx(room, 0, false)], [room.players[0]], "frozen");
  assert.deepEqual(snapshots(room.svm, [room.ledger, room.usdcVault, room.tokens[0].usdc]), before);
  room.svm.setAccount(room.tokens[0].usdc, original);
  success(room.svm, [await claimIx(room, 0, false)], [room.players[0]]);
});

test("unsolicited WSOL is not swapped or distributed to players", async () => {
  const room = await roomFixture();
  await fundAndStart(room);
  success(room.svm, [createTransferCheckedInstruction(room.tokens[0].wsol, NATIVE_MINT, room.wsolVault, room.players[0].publicKey, 123n, 9)], [room.players[0]]);
  await injectReturnedControlFixture(room, 15);
  setTime(room.svm, 1_002n);
  success(room.svm, [await executeIx(room)], [room.players[0]]);
  assert.equal(balance(room.svm, room.wsolVault), 123n);
  assert.equal(ledgerState(room.svm, room.ledger).economics!.swappedWsol.toString(), "4000000");
});

test("serialized room version and accounting corruption fail closed", async () => {
  const room = await roomFixture();
  await fundAndStart(room);
  setTime(room.svm, 1_120n);
  const original = room.svm.getAccount(room.ledger)!;
  const recover = await program.methods.recoverRound().accountsStrict({ ledger: room.ledger }).instruction();
  for (const corrupt of [
    (state: ReturnType<typeof ledgerState>) => { state.version = 1; },
    (state: ReturnType<typeof ledgerState>) => { state.economics!.initialWsol = state.economics!.initialWsol.addn(4); },
    (state: ReturnType<typeof ledgerState>) => { state.economics!.holdings[0] = state.economics!.holdings[0].addn(1); },
    (state: ReturnType<typeof ledgerState>) => { state.wallets[1] = state.wallets[0]; },
  ]) {
    const state = ledgerState(room.svm, room.ledger);
    corrupt(state);
    const encoded = await program.coder.accounts.encode("roomLedger", state);
    const padded = Buffer.alloc(original.data.length);
    encoded.copy(padded);
    room.svm.setAccount(room.ledger, { ...original, data: padded });
    const before = data(room.svm, room.ledger);
    rejects(room.svm, [recover], [room.players[0]]);
    assert.deepEqual(data(room.svm, room.ledger), before);
    room.svm.setAccount(room.ledger, original);
  }
});
