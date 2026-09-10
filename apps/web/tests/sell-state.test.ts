import { expect, it } from "vitest";
import { quoteSell } from "@flinch/client";
import { sellState } from "../src/features/match/sell-state.ts";
import { control, snapshot } from "../../../tests/keeper/fixtures.ts";

function fixture() {
  const room = snapshot();
  const live = { ...control(room), sellers: 0 };
  const quote = quoteSell({ pool: room.ledger.pool, slot: 50, chainTime: 101n, receivedAtMs: 1000,
    inputReserve: 100_000_000_000n, outputReserve: 20_000_000_000n, tradeFeeRate: 2500n,
    creatorFeeRate: 0n, fundFeeRate: 0n, protocolFeeRate: 0n, creatorFeeOnInput: true }, live, 0, 101n, 100, 1000);
  return { room, live, quote };
}

it("uses ER cohort time to expire a quote before its wall-clock deadline", () => {
  const { room, live, quote } = fixture();
  expect(sellState(room, live, 0, 101n, quote, 1500).fresh).toBe(true);
  const state = sellState(room, live, 0, 102n, quote, 1500);
  expect(state.fresh).toBe(false);
  expect(state.quoteIssue).toBe("Quote cohort closed");
});

it("disables SELL for the last holder and an unavailable next cohort", () => {
  const { room, live } = fixture();
  expect(sellState(room, { ...live, holdings: [1n, 0n, 0n, 0n] }, 0, 101n).unavailable).toMatch(/final holder/);
  expect(sellState(room, { ...live, nextCohort: 1 }, 0, 101n).available).toBe(false);
  expect(sellState(room, { ...live, sellers: 2 }, 0, 102n).available).toBe(false);
});

it("rejects stale holdings, nonces, attempts and backwards wall time in the visible quote", () => {
  const { room, live, quote } = fixture();
  expect(sellState(room, { ...live, holdings: [2n, 1n, 1n, 1n] }, 0, 101n, quote, 1500).fresh).toBe(false);
  expect(sellState(room, { ...live, nonces: [9n, 0n, 0n, 0n] }, 0, 101n, quote, 1500).fresh).toBe(false);
  expect(sellState(room, { ...live, attempts: [3, 0, 0, 0] }, 0, 101n, quote, 1500).available).toBe(false);
  expect(sellState(room, live, 0, 101n, quote, 999).fresh).toBe(false);
});

it("keeps queued and confirmed states distinct and never enables stale or spectator controls", () => {
  const { room, live, quote } = fixture();
  const queued = sellState(room, { ...live, sellers: 1 }, 0, 101n, quote, 1500);
  expect(queued.pending).toBe(true);
  expect(queued.exited).toBe(false);
  expect(queued.available).toBe(false);
  expect(sellState(room, undefined, 0, 101n, quote, 1500).fresh).toBe(false);
  expect(sellState(room, live, -1, 101n).available).toBe(false);
  expect(sellState(room, live, 0, 190n).available).toBe(false);
});
