import { test } from "node:test";
import assert from "node:assert/strict";
import { PublicKey } from "@solana/web3.js";
import { decide } from "../../apps/keeper/src/decision.ts";
import { snapshot, control } from "./fixtures.ts";

test("funding requires four seats and cancellation wins at the deadline", () => {
  const room = snapshot(299n);
  const funding = { ...room, ledger: { ...room.ledger, phase: "funding" as const, economics: null } };
  assert.deepEqual(decide(funding), { kind: "act", action: "start", revision: null });
  assert.equal(decide({ ...funding, ledger: { ...funding.ledger, wallets: [PublicKey.default, funding.ledger.wallets[1], funding.ledger.wallets[2], funding.ledger.wallets[3]] } }).kind, "wait");
  assert.deepEqual(decide({ ...funding, now: 300n }), { kind: "act", action: "cancel", revision: null });
});

test("ER closes the cohort while base enforces its own execution window", () => {
  const room = snapshot();
  const live = control(room);
  assert.equal(decide(room).kind, "resolve");
  assert.equal(decide(room, { control: live, now: 101n }).kind, "wait");
  assert.deepEqual(decide(room, { control: live, now: 102n }), { kind: "act", action: "freeze", revision: 0n });
  const returned = { ...room, control: { kind: "base" as const, value: { ...live, phase: "frozen" as const } } };
  assert.equal(decide(returned).kind, "wait");
  for (const now of [102n, 116n]) assert.deepEqual(decide({ ...returned, now }), { kind: "act", action: "execute", revision: 0n });
  assert.deepEqual(decide({ ...returned, now: 117n }), { kind: "act", action: "expire", revision: 0n });
});

test("stale snapshots wait, round end stops redelegation, and hard recovery ignores Control", () => {
  const room = snapshot();
  const prepared = control(room, "prepared");
  const base = { ...room, control: { kind: "base" as const, value: prepared } };
  assert.deepEqual(decide(base), { kind: "act", action: "delegate", revision: 0n });
  assert.equal(decide({ ...base, control: { kind: "base", value: { ...prepared, revision: 1n } } }).kind, "wait");
  assert.equal(decide({ ...base, now: 190n }).kind, "wait");
  assert.equal(decide({ ...base, now: 219n, control: { kind: "missing" } }).kind, "wait");
  for (const ctl of [base.control, { kind: "missing" as const }, { kind: "delegated" as const }]) {
    assert.deepEqual(decide({ ...base, now: 220n, control: ctl }), { kind: "act", action: "recover", revision: 0n });
  }
  assert.equal(decide({ ...base, ledger: { ...base.ledger, economics: { ...base.ledger.economics!, terminalTag: 1 } } }).kind, "done");
});
