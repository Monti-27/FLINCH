import { expect, it } from "vitest";
import { advanceCountdown, observeCountdown, startCountdown } from "../src/features/match/countdown-clock.ts";
import type { TimerObservation } from "../src/features/match/countdown-clock.ts";
import { estimatedTime } from "../src/features/match/timer-state.ts";

const sample = (chainNow: bigint, receivedAt: number): TimerObservation => ({ startedAt: 1000n, chainNow, receivedAt });

it("reproduces the old 67 to 64 jump without applying that jump to the shared clock", () => {
  const before = sample(1023n, 23_000);
  const after = sample(1026n, 23_500);
  expect(Math.ceil(estimatedTime(before.startedAt, before.chainNow, before.receivedAt, 23_250) / 1000)).toBe(67);
  expect(Math.ceil(estimatedTime(after.startedAt, after.chainNow, after.receivedAt, 23_500) / 1000)).toBe(64);
  const clock = observeCountdown(startCountdown(before, 23_000), after, 23_500);
  expect(clock.remaining).toBe(66_500);
  expect(advanceCountdown(clock, 23_750).remaining).toBe(66_225);
});

it("counts through every second with irregular, repeated and backwards chain readings", () => {
  let clock = startCountdown(sample(1000n, 0), 0);
  let last = clock.remaining;
  const seconds = [90];
  for (let now = 25; now <= 100_000; now += 25) {
    const jitter = [0, -2, 1, 0, -1, 2][Math.floor(now / 1500) % 6];
    clock = now % 1500 === 0 && now < 88_000
      ? observeCountdown(clock, sample(1000n + BigInt(Math.floor(now / 1000) + jitter), now), now)
      : advanceCountdown(clock, now);
    expect(clock.remaining).toBeLessThanOrEqual(last);
    expect(last - clock.remaining).toBeLessThanOrEqual(27.501);
    const second = Math.ceil(clock.remaining / 1000);
    if (seconds.at(-1) !== second) seconds.push(second);
    last = clock.remaining;
  }
  expect(seconds).toEqual(Array.from({ length: 91 }, (_, index) => 90 - index));
});

it("accounts for base-to-ER delivery delay before the initial render", () => {
  expect(startCountdown(sample(1020n, 1000), 4400).remaining).toBe(66_600);
});

it("never resets a deadline for repeated or out-of-order observations", () => {
  const clock = startCountdown(sample(1020n, 1000), 1000);
  expect(observeCountdown(clock, sample(1020n, 2000), 2000).deadline).toBe(clock.deadline);
  expect(observeCountdown(clock, sample(1019n, 3000), 3000).deadline).toBe(clock.deadline);
  expect(observeCountdown(clock, sample(1021n, 900), 3000).deadline).toBe(clock.deadline);
});

it("continues through missing observations and catches up after a suspended tab", () => {
  const clock = startCountdown(sample(1020n, 1000), 1000);
  expect(advanceCountdown(clock, 21_000).remaining).toBe(50_000);
  expect(advanceCountdown(clock, 100_000).remaining).toBe(0);
});

it("does not revive a zero estimate when fresh readings lag behind", () => {
  const clock = advanceCountdown(startCountdown(sample(1088n, 0), 0), 3000);
  expect(observeCountdown(clock, sample(1089n, 3100), 3100).remaining).toBe(0);
});

it("honours a confirmed expired clock immediately instead of smoothing extra play time", () => {
  const clock = startCountdown(sample(1085n, 0), 0);
  expect(observeCountdown(clock, sample(1090n, 1000), 1000).remaining).toBe(0);
});

it("resets only for a different round start", () => {
  const clock = advanceCountdown(startCountdown(sample(1088n, 0), 0), 3000);
  const next = { startedAt: 2000n, chainNow: 2000n, receivedAt: 4000 };
  expect(observeCountdown(clock, next, 4000).remaining).toBe(90_000);
});

it("does not add time if a caller supplies an earlier monotonic timestamp", () => {
  const clock = startCountdown(sample(1020n, 1000), 1000);
  expect(advanceCountdown(clock, 500)).toEqual(clock);
});
