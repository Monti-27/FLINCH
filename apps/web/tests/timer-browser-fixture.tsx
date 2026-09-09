import { useState } from "react";
import { createRoot } from "react-dom/client";
import { UiProvider } from "../src/providers/ui-provider.tsx";
import { RoundTimer } from "../src/features/match/round-timer.tsx";
import type { TimerObservation } from "../src/features/match/countdown-clock.ts";
import { estimatedTime } from "../src/features/match/timer-state.ts";
import { TimerSyncFixture } from "./timer-sync-fixture.tsx";
import "../src/styles/palette.css";
import "../src/styles/tokens.css";

function Fixture() {
  const [milliseconds, setMilliseconds] = useState(90_000);
  const [observation, setObservation] = useState<TimerObservation>();
  const [funding, setFunding] = useState(true);
  const [stale, setStale] = useState(false);
  const [ended, setEnded] = useState(false);
  return <main>
    <section aria-label="Timer fixture"><h1>Who sells first?</h1>
      <RoundTimer milliseconds={BigInt(milliseconds)} funding={funding} stale={stale} ended={ended} observation={observation} />
    </section>
    <nav aria-label="Fixture controls">
      <label>Milliseconds<input type="number" value={milliseconds} onChange={event => { setObservation(undefined); setFunding(false); setEnded(false); setMilliseconds(Number(event.target.value)); }} /></label>
      <button onClick={() => { setFunding(false); setEnded(false); setObservation({ startedAt: 1000n, chainNow: 1000n + BigInt(Math.floor((90_000 - milliseconds) / 1000)), receivedAt: performance.now() }); }}>Start</button>
      <button onClick={() => { if (observation) setMilliseconds(estimatedTime(observation.startedAt, observation.chainNow, observation.receivedAt, performance.now())); setObservation(undefined); }}>Pause</button>
      <button onClick={() => { setObservation(undefined); setMilliseconds(90_000); setFunding(true); setEnded(false); setStale(false); }}>Reset</button>
      <button onClick={() => setStale(value => !value)}>Toggle stale</button>
      <button onClick={() => { setObservation(undefined); setEnded(true); }}>End</button>
    </nav>
    <p>Isolated timer test. No wallet, chain, or market connection.</p>
  </main>;
}

createRoot(document.getElementById("root")!).render(<UiProvider>{location.search.includes("sync") ? <TimerSyncFixture /> : <Fixture />}</UiProvider>);
