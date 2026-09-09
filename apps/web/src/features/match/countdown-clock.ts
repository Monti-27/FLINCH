import { ROUND_DURATION_MS, estimatedTime } from "./timer-state.ts";

export type TimerObservation = { startedAt: bigint; chainNow: bigint; receivedAt: number };
export type CountdownClock = {
  sample: TimerObservation;
  remaining: number;
  deadline: number;
  updatedAt: number;
};

const CORRECTION_RATE = .1;
const RESUME_GAP_MS = 5000;

export function startCountdown(sample: TimerObservation, now: number): CountdownClock {
  const remaining = estimatedTime(sample.startedAt, sample.chainNow, sample.receivedAt, now);
  return { sample, remaining, deadline: now + remaining, updatedAt: now };
}

export function advanceCountdown(clock: CountdownClock, now: number): CountdownClock {
  const elapsed = Math.max(0, now - clock.updatedAt);
  const target = Math.max(0, clock.deadline - now);
  const projected = Math.max(0, clock.remaining - elapsed);
  const correction = Math.max(-elapsed * CORRECTION_RATE, Math.min(elapsed * CORRECTION_RATE, target - projected));
  const remaining = elapsed >= RESUME_GAP_MS ? Math.min(projected, target) : projected + correction;
  return { ...clock, remaining: Math.max(0, Math.min(clock.remaining, remaining)), updatedAt: Math.max(now, clock.updatedAt) };
}

export function observeCountdown(clock: CountdownClock | undefined, sample: TimerObservation, now: number): CountdownClock {
  if (!clock || clock.sample.startedAt !== sample.startedAt) return startCountdown(sample, now);
  const current = advanceCountdown(clock, now);
  if (sample.receivedAt <= clock.sample.receivedAt || sample.chainNow <= clock.sample.chainNow) return current;
  const next = startCountdown(sample, now);
  return { ...current, sample, deadline: next.deadline,
    remaining: sample.chainNow >= sample.startedAt + BigInt(ROUND_DURATION_MS / 1000) ? 0 : current.remaining };
}
