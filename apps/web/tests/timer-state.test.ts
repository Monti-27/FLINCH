import { expect, it } from "vitest";
import { ROUND_DURATION_MS, DIAL_TICKS, DIAL_ACTIVE_LENGTH, DIAL_REST_LENGTH, boundedTime, dialColor, estimatedTime, tickFill, tickLength } from "../src/features/match/timer-state.ts";

it("bounds exact millisecond inputs before converting for presentation", () => {
  expect(boundedTime(-1n)).toBe(0);
  expect(boundedTime(90_001n)).toBe(ROUND_DURATION_MS);
  expect(boundedTime(2n ** 100n)).toBe(ROUND_DURATION_MS);
  expect(boundedTime(43_125n)).toBe(43_125);
});

it("uses the stored chain clock and elapsed observation time, not a fresh 90 second loop", () => {
  expect(estimatedTime(1000n, 1040n, 5000, 5750)).toBe(49_250);
  expect(estimatedTime(1000n, 1040n, 5000, 15_000)).toBe(40_000);
  expect(estimatedTime(1000n, 1040n, 5000, 100_000)).toBe(0);
  expect(estimatedTime(1000n, 1040n, 5000, 4900)).toBe(50_000);
});

it("resynchronizes against fresh observations and clamps before start or after expiry", () => {
  expect(estimatedTime(1000n, 999n, 5000, 5000)).toBe(90_000);
  expect(estimatedTime(1000n, 1100n, 5000, 5000)).toBe(0);
  expect(estimatedTime(1000n, 1050n, 15_000, 15_000)).toBe(40_000);
});

it("conserves the filled circumference across every second of a round", () => {
  for (let millisecond = 0; millisecond <= ROUND_DURATION_MS; millisecond += 125) {
    const progress = millisecond / ROUND_DURATION_MS;
    const fills = Array.from({ length: DIAL_TICKS }, (_, index) => tickFill(progress, index));
    expect(fills.reduce((total, value) => total + value, 0)).toBeCloseTo(progress * DIAL_TICKS, 10);
    expect(fills.every(value => value >= 0 && value <= 1)).toBe(true);
    expect(fills.filter(value => value > 0 && value < 1).length).toBeLessThanOrEqual(1);
  }
});

it("extends active bars and retracts empty bars without moving their inner anchors", () => {
  for (let index = 0; index < DIAL_TICKS; index++) {
    expect(tickLength(0, index)).toBe(DIAL_REST_LENGTH);
    expect(tickLength(1, index)).toBe(DIAL_ACTIVE_LENGTH);
    expect(tickLength(.5, index)).toBeGreaterThanOrEqual(DIAL_REST_LENGTH - 2.5);
    expect(tickLength(.5, index)).toBeLessThanOrEqual(DIAL_ACTIVE_LENGTH + 2.5);
  }
});

it("lifts and lowers neighbouring bars around the changing edge", () => {
  expect(tickLength(.5, 35)).toBeGreaterThan(DIAL_ACTIVE_LENGTH);
  expect(tickLength(.5, 36)).toBeLessThan(DIAL_REST_LENGTH);
  expect(tickLength(.5, 0)).toBeCloseTo(DIAL_ACTIVE_LENGTH, 6);
  expect(tickLength(.5, 71)).toBeCloseTo(DIAL_REST_LENGTH, 6);
});

it("follows the reference blue, green, amber progression with blended boundaries", () => {
  expect(dialColor(1)).toBe("var(--dial-blue)");
  expect(dialColor(.5)).toBe("var(--dial-green)");
  expect(dialColor(.1)).toBe("var(--dial-amber)");
  expect(dialColor(.78)).toContain("color-mix");
  expect(dialColor(.24)).toContain("color-mix");
});
