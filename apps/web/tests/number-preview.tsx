import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { formatUnits } from "@flinch/client";
import AnimatedNumberCounter from "../src/components/ui/count-down-numbers.tsx";
import { Badge } from "../src/components/ui/badge.tsx";
import { PlayerSeat } from "../src/features/match/player-seat.tsx";
import { SellTicket } from "../src/features/match/sell-ticket.tsx";
import "../src/app/globals.css";
import "@fontsource-variable/manrope";
import "@fontsource-variable/space-grotesk";
import "./number-preview.css";

function NumberPreview() {
  const [value, setValue] = useState<string | null>("142.10");
  const [identity, setIdentity] = useState("first");
  const [holding, setHolding] = useState(1_000_000n);
  const [visible, setVisible] = useState(true);
  return <main className="number-preview">
    <Badge variant="outline">Number animation test fixture</Badge>
    <h1>Rolling numbers</h1>
    <p>Isolated presentation checks. No wallet, price feed or transactions.</p>
    <div className="preview-number" data-testid="primary">
      {visible && <AnimatedNumberCounter value={value} identity={identity} prefix="$" />}
    </div>
    <div className="preview-controls">
      <label>Display value<input aria-label="Display value" value={value ?? ""} onChange={event => setValue(event.target.value)} /></label>
      <button onClick={() => setValue("143.10")}>Increase</button>
      <button onClick={() => setValue("144.10")}>Increase again</button>
      <button onClick={() => setValue("141.10")}>Decrease</button>
      <button onClick={() => setValue(null)}>No data</button>
      <button onClick={() => { setIdentity(identity === "first" ? "second" : "first"); setValue("240.00"); }}>Change account</button>
      <button onClick={() => setVisible(!visible)}>Toggle number</button>
      <button onClick={() => setHolding(holding + 1n)}>Add one lamport</button>
    </div>
    <div data-testid="exact"><AnimatedNumberCounter value={formatUnits((1n << 64n) - 1n, 9)} /></div>
    <div data-testid="neutral"><AnimatedNumberCounter value={value} flashOnChange={false} /></div>
    <section className="preview-tickets">
      <div className="panel"><SellTicket holding={holding} fresh={false} sessionReady={false} loading={false} busy={false}
        canQuote={false} canQueue={false} onQuote={() => {}} onQueue={() => {}} /></div>
      <PlayerSeat index={0} yours wallet="11111111111111111111111111111111" state="Holding" holding={holding} claim={0n} />
    </section>
  </main>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><NumberPreview /></StrictMode>);
