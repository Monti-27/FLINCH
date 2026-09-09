import { useState } from "react";
import { createRoot } from "react-dom/client";
import { RoomNavigation } from "../src/components/shell/room-navigation.tsx";
import "../src/styles/palette.css";
import "../src/styles/tokens.css";
import "../src/styles/base.css";
import "../src/styles/controls.css";
import "@fontsource-variable/manrope";
import "@fontsource-variable/space-grotesk";
import "./room-navigation-fixture.css";

function Fixture() {
  const [connected, setConnected] = useState(true);
  const [busy, setBusy] = useState(false);
  const [checks, setChecks] = useState(0);
  const [lobby, setLobby] = useState(0);
  const [release, setRelease] = useState<(() => void) | undefined>();
  const [reject, setReject] = useState<(() => void) | undefined>();
  const check = async () => {
    setChecks(value => value + 1);
    await new Promise<void>((resolve, fail) => { setRelease(() => resolve); setReject(() => () => fail(new Error("Read unavailable"))); });
  };
  return <>
    <RoomNavigation address="8mGLM6MoGgJBfJXAESN5C5fmKXCwnfinDGXX8drPFEie" connected={connected} busy={busy} onLobby={() => setLobby(value => value + 1)} onCheck={check} />
    <section className="fixture-controls" aria-label="Test controls">
      <h1>Room navigation test</h1><p>Real controls with simulated status reads. No wallet or onchain transactions.</p>
      <div><button onClick={() => setConnected(value => !value)}>Toggle wallet</button><button onClick={() => setBusy(value => !value)}>Toggle busy</button>
        <button onClick={() => release?.()}>Finish check</button><button onClick={() => reject?.()}>Fail check</button></div>
      <output aria-label="Checks">{checks}</output><output aria-label="Lobby visits">{lobby}</output>
    </section>
  </>;
}

createRoot(document.getElementById("root")!).render(<Fixture />);
