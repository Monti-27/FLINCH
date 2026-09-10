import { test } from "node:test";
import assert from "node:assert/strict";
import { NATIVE_MINT, TOKEN_PROGRAM_ID, createTransferCheckedInstruction } from "@solana/spl-token";
import { claimIx, fundAndStart, joinIx, roomFixture, snapshots, startIx } from "./support/room.ts";
import { data, ledgerState, program, rejects, setTime, success, wallet } from "./support/runtime.ts";
import { balance, playerTokens } from "./support/tokens.ts";

test("wallet deposits are exact and duplicate seats cannot charge twice", async () => {
  const room = await roomFixture();
  const { svm, ledger, players, tokens, wsolVault } = room;
  const ix = await joinIx(room, 0);
  success(svm, [ix], [players[0]]);
  assert.equal(balance(svm, tokens[0].wsol), 19_000_000n);
  assert.equal(balance(svm, wsolVault), 1_000_000n);
  const before = snapshots(svm, [ledger, tokens[0].wsol, wsolVault]);
  rejects(svm, [ix], [players[0]], "DuplicateWallet");
  assert.deepEqual(snapshots(svm, [ledger, tokens[0].wsol, wsolVault]), before);
  rejects(svm, [await startIx(room)], [players[0]], "RoomNotFull");
});

test("prestart cancellation refunds each wallet once and leaves donations untouched", async () => {
  const room = await roomFixture();
  const { svm, ledger, players, tokens, wsolVault } = room;
  for (let seat = 0; seat < 2; seat++) success(svm, [await joinIx(room, seat)], [players[seat]]);
  success(svm, [createTransferCheckedInstruction(tokens[2].wsol, NATIVE_MINT, wsolVault, players[2].publicKey, 7n, 9)], [players[2]]);
  const cancel = await program.methods.cancelRoom().accountsStrict({ caller: players[1].publicKey, ledger }).instruction();
  rejects(svm, [cancel], [players[1]], "Unauthorized");
  success(svm, [await program.methods.cancelRoom().accountsStrict({ caller: players[0].publicKey, ledger }).instruction()], [players[0]]);
  rejects(svm, [await joinIx(room, 2)], [players[2]], "WrongPhase");
  for (let seat = 0; seat < 2; seat++) {
    const claim = await claimIx(room, seat, true);
    success(svm, [claim], [players[seat]]);
    assert.equal(balance(svm, tokens[seat].wsol), 20_000_000n);
    rejects(svm, [claim], [players[seat]], "NothingToClaim");
  }
  assert.equal(balance(svm, wsolVault), 7n);
});

test("funding timeout permits cancellation but rejects a late start", async () => {
  const room = await roomFixture();
  for (let seat = 0; seat < 4; seat++) success(room.svm, [await joinIx(room, seat)], [room.players[seat]]);
  setTime(room.svm, 1_300n);
  rejects(room.svm, [await startIx(room)], [room.players[0]], "FundingExpired");
  success(room.svm, [await program.methods.cancelRoom().accountsStrict({ caller: room.players[3].publicKey, ledger: room.ledger }).instruction()], [room.players[3]]);
});

test("recovery and claims work with the control account absent", async () => {
  const room = await roomFixture();
  await fundAndStart(room);
  const { svm, ledger, players, control, wsolVault, tokens } = room;
  rejects(svm, [await claimIx(room, 0, true)], [players[0]], "DomainRejected");
  const recover = await program.methods.recoverRound().accountsStrict({ ledger }).instruction();
  setTime(svm, 1_119n);
  rejects(svm, [recover], [players[0]], "DomainRejected");
  svm.setAccount(control, { data: new Uint8Array(), lamports: 0, executable: false, owner: TOKEN_PROGRAM_ID });
  setTime(svm, 1_120n);
  success(svm, [recover], [players[0]]);
  rejects(svm, [recover], [players[0]], "DomainRejected");
  for (let seat = 0; seat < 4; seat++) {
    success(svm, [await claimIx(room, seat, true)], [players[seat]]);
    assert.equal(balance(svm, tokens[seat].wsol), 20_000_000n);
  }
  assert.equal(balance(svm, wsolVault), 0n);
  assert.equal(ledgerState(svm, ledger).economics!.claimedWsol.toString(), "4000000");
});

test("another wallet cannot redirect a claim or supply its tokens for a player's seat", async () => {
  const room = await roomFixture();
  const outsider = wallet(room.svm);
  const outsiderTokens = playerTokens(room.svm, outsider);
  const join = await program.methods.joinRoom().accountsStrict({ player: room.players[0].publicKey, ledger: room.ledger,
    mint: NATIVE_MINT, source: outsiderTokens.wsol, vault: room.wsolVault, tokenProgram: TOKEN_PROGRAM_ID }).instruction();
  rejects(room.svm, [join], [room.players[0]], "ConstraintTokenOwner");
  success(room.svm, [await joinIx(room, 0)], [room.players[0]]);
  success(room.svm, [await program.methods.cancelRoom().accountsStrict({ caller: room.players[0].publicKey, ledger: room.ledger }).instruction()], [room.players[0]]);
  const before = data(room.svm, room.ledger);
  const claim = await program.methods.claimWsol().accountsStrict({ player: room.players[0].publicKey, ledger: room.ledger,
    mint: NATIVE_MINT, vault: room.wsolVault, destination: outsiderTokens.wsol, tokenProgram: TOKEN_PROGRAM_ID }).instruction();
  rejects(room.svm, [claim], [room.players[0]], "ConstraintTokenOwner");
  const outsiderClaim = await program.methods.claimWsol().accountsStrict({ player: outsider.publicKey, ledger: room.ledger,
    mint: NATIVE_MINT, vault: room.wsolVault, destination: outsiderTokens.wsol, tokenProgram: TOKEN_PROGRAM_ID }).instruction();
  rejects(room.svm, [outsiderClaim], [outsider], "Unauthorized");
  assert.deepEqual(data(room.svm, room.ledger), before);
});
