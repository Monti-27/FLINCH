"use client";

import { useEffect, useRef, useState } from "react";
import { cancelFrame, frame, useMotionValue, useMotionValueEvent } from "framer-motion";
import { advanceCountdown, observeCountdown } from "./countdown-clock.ts";
import type { CountdownClock, TimerObservation } from "./countdown-clock.ts";
import { ROUND_DURATION_MS, boundedTime, estimatedTime } from "./timer-state.ts";

export function useCountdown(milliseconds: bigint, funding: boolean, ended: boolean, observation?: TimerObservation) {
  const clock = useRef<CountdownClock | undefined>(undefined);
  const initial = ended ? 0 : funding ? ROUND_DURATION_MS : observation
    ? estimatedTime(observation.startedAt, observation.chainNow, observation.receivedAt, performance.now()) : boundedTime(milliseconds);
  const remaining = useMotionValue(initial);
  const [seconds, setSeconds] = useState(Math.ceil(initial / 1000));
  const previousSecond = useRef(seconds);
  const startedAt = observation?.startedAt;
  const chainNow = observation?.chainNow;
  const receivedAt = observation?.receivedAt;
  const running = !!observation && !funding && !ended && seconds > 0;
  useMotionValueEvent(remaining, "change", value => {
    const next = Math.ceil(value / 1000);
    if (previousSecond.current === next) return;
    previousSecond.current = next;
    setSeconds(next);
  });
  useEffect(() => {
    if (ended || funding || startedAt === undefined || chainNow === undefined || receivedAt === undefined) {
      clock.current = undefined;
      remaining.set(ended ? 0 : funding ? ROUND_DURATION_MS : boundedTime(milliseconds));
      return;
    }
    clock.current = observeCountdown(clock.current, { startedAt, chainNow, receivedAt }, performance.now());
    remaining.set(clock.current.remaining);
  }, [startedAt, chainNow, receivedAt, milliseconds, funding, ended, remaining]);
  useEffect(() => {
    if (!running) return;
    const tick = () => {
      if (!clock.current || document.hidden) return;
      clock.current = advanceCountdown(clock.current, performance.now());
      remaining.set(clock.current.remaining);
    };
    frame.update(tick, true);
    document.addEventListener("visibilitychange", tick);
    return () => { cancelFrame(tick); document.removeEventListener("visibilitychange", tick); };
  }, [running, remaining]);
  return { remaining, seconds };
}
