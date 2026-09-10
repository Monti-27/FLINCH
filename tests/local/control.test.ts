import { test } from "node:test";
import assert from "node:assert/strict";
import { MAGIC_CONTEXT_ID, MAGIC_PROGRAM_ID } from "@magicblock-labs/ephemeral-rollups-sdk";
import { joinIx, roomFixture, startIx, replaceControlFixture, expireIx } from "./support/room.ts";
import type { Room } from "./support/room.ts";
import { BN, controlState, data, program, rejects, setTime, success, wallet } from "./support/runtime.ts";
import { sessionInstructions } from "./support/session.ts";

async function liveControlFixture(room: Room) {
  const control = controlState(room.svm, room.control);
  control.phase = { live: {} };
  await replaceControlFixture(room, control);
}

async function setup() {
  const room = await roomFixture();
  const session = wallet(room.svm);
  const authorization = await sessionInstructions(room.players[0], session, 1_010n);
  room.svm.addProgramFromFile(authorization.programId, "node_modules/@magicblock-labs/ephemeral-validator/bin/local-dumps/KeyspM2ssCJbqUhQ4k7sveSiY4WjnYsrXkC8oDbwde5.so");
  success(room.svm, [authorization.instruction], [room.players[0], session]);
  for (let seat = 0; seat < 4; seat++) success(room.svm, [await joinIx(room, seat)], [room.players[seat]]);
  const bind = await program.methods.setSessionSigner(session.publicKey).accountsStrict({ player: room.players[0].publicKey, ledger: room.ledger }).instruction();
  success(room.svm, [bind, await startIx(room)], [room.players[0]]);
  return { room, session, authorization, bind };
}

test("SELL requires the correct wallet or bound session and does not move custody", async () => {
  const { room, session, authorization, bind } = await setup();
  const queue = await program.methods.queueSell(0, new BN(1), new BN(1)).accountsStrict({
    signer: session.publicKey, control: room.control, sessionToken: authorization.address }).instruction();
  rejects(room.svm, [queue], [session], "InvalidControl");
  rejects(room.svm, [bind], [room.players[0]], "WrongPhase");
  await liveControlFixture(room);
  const ledger = data(room.svm, room.ledger);
  const vault = data(room.svm, room.wsolVault);
  success(room.svm, [queue], [session]);
  assert.equal(controlState(room.svm, room.control).sellers, 1);
  rejects(room.svm, [queue], [session], "InvalidControl");
  const wrongSeat = await program.methods.queueSell(1, new BN(1), new BN(1)).accountsStrict({
    signer: session.publicKey, control: room.control, sessionToken: authorization.address }).instruction();
  rejects(room.svm, [wrongSeat], [session], "Unauthorized");
  assert.deepEqual(data(room.svm, room.ledger), ledger);
  assert.deepEqual(data(room.svm, room.wsolVault), vault);
});

test("expired and revoked sessions reject while the actual wallet remains usable", async () => {
  for (const revoke of [false, true]) {
    const { room, session, authorization } = await setup();
    await liveControlFixture(room);
    if (revoke) success(room.svm, [authorization.revoke], [room.players[0]]);
    else setTime(room.svm, 1_010n);
    const queue = await program.methods.queueSell(0, new BN(1), new BN(1)).accountsStrict({
      signer: session.publicKey, control: room.control, sessionToken: authorization.address }).instruction();
    rejects(room.svm, [queue], [session]);
    const walletQueue = await program.methods.queueSell(0, new BN(1), new BN(1)).accountsStrict({
      signer: room.players[0].publicKey, control: room.control, sessionToken: null }).instruction();
    success(room.svm, [walletQueue], [room.players[0]]);
  }
});

test("one pending cohort blocks later cohorts and ordinary base calls cannot freeze it", async () => {
  const { room } = await setup();
  await liveControlFixture(room);
  const queue = await program.methods.queueSell(0, new BN(1), new BN(1)).accountsStrict({
    signer: room.players[0].publicKey, control: room.control, sessionToken: null }).instruction();
  success(room.svm, [queue], [room.players[0]]);
  setTime(room.svm, 1_002n);
  const later = await program.methods.queueSell(1, new BN(1), new BN(1)).accountsStrict({
    signer: room.players[1].publicKey, control: room.control, sessionToken: null }).instruction();
  rejects(room.svm, [later], [room.players[1]], "InvalidControl");
  const before = data(room.svm, room.control);
  const freeze = await program.methods.freezeBatch().accountsStrict({ payer: room.players[0].publicKey,
    control: room.control, magicContext: MAGIC_CONTEXT_ID, magicProgram: MAGIC_PROGRAM_ID }).instruction();
  rejects(room.svm, [freeze], [room.players[0]]);
  assert.deepEqual(data(room.svm, room.control), before);
});

test("three expired attempts exhaust a seat and nonces cannot replay after expiry", async () => {
  const { room } = await setup();
  for (let attempt = 1; attempt <= 3; attempt++) {
    await liveControlFixture(room);
    const control = controlState(room.svm, room.control);
    const now = 1_000n + BigInt(control.nextCohort) * 2n;
    setTime(room.svm, now);
    const stale = await program.methods.queueSell(0, new BN(attempt - 1), new BN(1)).accountsStrict({
      signer: room.players[0].publicKey, control: room.control, sessionToken: null }).instruction();
    rejects(room.svm, [stale], [room.players[0]], "InvalidControl");
    const queue = await program.methods.queueSell(0, new BN(attempt), new BN(1)).accountsStrict({
      signer: room.players[0].publicKey, control: room.control, sessionToken: null }).instruction();
    success(room.svm, [queue], [room.players[0]]);
    const pending = controlState(room.svm, room.control);
    pending.phase = { frozen: {} };
    await replaceControlFixture(room, pending);
    setTime(room.svm, now + 17n);
    success(room.svm, [await expireIx(room)], [room.players[0]]);
  }
  await liveControlFixture(room);
  const fourth = await program.methods.queueSell(0, new BN(4), new BN(1)).accountsStrict({
    signer: room.players[0].publicKey, control: room.control, sessionToken: null }).instruction();
  rejects(room.svm, [fourth], [room.players[0]], "InvalidControl");
  assert.equal(controlState(room.svm, room.control).attempts[0], 3);
});
