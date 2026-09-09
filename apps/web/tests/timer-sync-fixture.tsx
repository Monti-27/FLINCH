import { useEffect, useState } from "react";
import { RoundTimer } from "../src/features/match/round-timer.tsx";
import type { TimerObservation } from "../src/features/match/countdown-clock.ts";

declare global {
  interface Window {
    timerTest: {
      observe: (chainNow: number, age?: number) => void;
      reset: (startedAt: number, chainNow: number) => void;
      stale: (value: boolean) => void;
      end: () => void;
    };
  }
}

export function TimerSyncFixture() {
  const [observation, setObservation] = useState<TimerObservation>({ startedAt: 1000n, chainNow: 1023n, receivedAt: performance.now() });
  const [stale, setStale] = useState(false);
  const [ended, setEnded] = useState(false);
  const [room, setRoom] = useState(0);
  useEffect(() => {
    window.timerTest = {
      observe: (chainNow, age = 0) => setObservation(previous => ({ ...previous, chainNow: BigInt(chainNow), receivedAt: performance.now() - age })),
      reset: (startedAt, chainNow) => {
        setObservation({ startedAt: BigInt(startedAt), chainNow: BigInt(chainNow), receivedAt: performance.now() });
        setRoom(previous => previous + 1);
        setStale(false);
        setEnded(false);
      },
      stale: setStale,
      end: () => setEnded(true),
    };
  }, []);
  return <main><section aria-label="Timer fixture"><h1>Timer synchronization</h1>
    <RoundTimer key={room} milliseconds={90_000n} funding={false} stale={stale} ended={ended} observation={observation} />
  </section><p>Irregular observation fixture. No wallet or network connection.</p></main>;
}
