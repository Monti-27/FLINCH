import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { UiProvider } from "../src/providers/ui-provider.tsx";
import { RoundTimer } from "../src/features/match/round-timer.tsx";
import "../src/styles/palette.css";
import "../src/styles/tokens.css";

function Fixture() {
  const [milliseconds, setMilliseconds] = useState(90_000);
  const [running, setRunning] = useState(false);
  const [funding, setFunding] = useState(true);
  const [stale, setStale] = useState(false);
  const [ended, setEnded] = useState(false);
  useEffect(() => {
    if (!running) return;
    const deadline = Date.now() + milliseconds;
    const timer = setInterval(() => setMilliseconds(Math.max(0, deadline - Date.now())), 250);
    return () => clearInterval(timer);
  }, [running]);
  return <main>
    <section aria-label="Timer fixture"><h1>Who sells first?</h1>
      <RoundTimer milliseconds={BigInt(milliseconds)} funding={funding} stale={stale} ended={ended} />
    </section>
    <nav aria-label="Fixture controls">
      <label>Milliseconds<input type="number" value={milliseconds} onChange={event => { setRunning(false); setFunding(false); setEnded(false); setMilliseconds(Number(event.target.value)); }} /></label>
      <button onClick={() => { setFunding(false); setEnded(false); setRunning(true); }}>Start</button>
      <button onClick={() => setRunning(false)}>Pause</button>
      <button onClick={() => { setRunning(false); setMilliseconds(90_000); setFunding(true); setEnded(false); setStale(false); }}>Reset</button>
      <button onClick={() => setStale(value => !value)}>Toggle stale</button>
      <button onClick={() => { setRunning(false); setEnded(true); }}>End</button>
    </nav>
    <p>Isolated timer test. No wallet, chain, or market connection.</p>
  </main>;
}

createRoot(document.getElementById("root")!).render(<UiProvider><Fixture /></UiProvider>);
