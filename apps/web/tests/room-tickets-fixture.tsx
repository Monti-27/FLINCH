import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Funding } from "../src/features/lobby/funding.tsx";
import { Claims } from "../src/features/claims/claims.tsx";
import { SellTicket } from "../src/features/match/sell-ticket.tsx";
import { TicketDisclosure } from "../src/components/ui/ticket-disclosure.tsx";
import { fixtureClient, fixtureSigner, ticketQuote, ticketRoom } from "./room-ticket-data.ts";
import "../src/styles/palette.css";
import "../src/styles/tokens.css";
import "../src/styles/base.css";
import "../src/styles/controls.css";
import "../src/styles/game.css";
import "../src/styles/lobby.css";
import "@fontsource-variable/manrope";
import "@fontsource-variable/space-grotesk";
import "./room-tickets-fixture.css";

function Fixture() {
  const [state, setState] = useState("joined");
  const [pending, setPending] = useState(false);
  const [requests, setRequests] = useState(0);
  const [reject, setReject] = useState<(() => void) | undefined>();
  const room = ticketRoom(state);
  const run = async () => { setRequests(value => value + 1); await new Promise<void>((_, fail) => setReject(() => () => { fail(new Error("User rejected the wallet request")); setReject(undefined); })); };
  const funding = <Funding client={fixtureClient} room={room} signer={state === "entry" ? undefined : fixtureSigner}
    remember={() => {}} busy={false} enabled run={run} />;
  const sell = ["sell", "quote", "stale", "loading", "precision"].includes(state);
  return <main className="ticket-fixture">
    <header><h1>Room ticket checks</h1><p>Isolated presentation data. No wallet, RPC connection or transactions.</p></header>
    <nav aria-label="Fixture states">{["entry", "joined", "full", "expired", "refund", "usdc", "claimed", "recovery", "sell", "quote", "stale", "loading", "precision"].map(value =>
      <button key={value} onClick={() => { setState(value); setPending(false); }} aria-pressed={state === value}>{value}</button>)}
      <button onClick={() => setPending(value => !value)}>Toggle pending</button><button onClick={() => reject?.()}>Reject approval</button>
    </nav>
    <section className="fixture-workspace" aria-label="Room ticket fixture">
      <div className="room-controls" key={state}>
        {room.ledger.phase === "funding" ? funding : <>
          {sell ? <section className="panel sell-panel"><h2>Your position</h2><SellTicket holding={state === "precision" ? (1n << 64n) - 1n : 4_000_001n}
            quote={["quote", "stale"].includes(state) ? ticketQuote : undefined} fresh={state === "quote"} quoteIssue="Quote expired; refresh before signing"
            sessionReady loading={state === "loading"} busy={false} canQuote canQueue onQuote={() => setState("quote")} onQueue={() => {}} /></section>
            : <Claims client={fixtureClient} room={room} seat={0} signer={fixtureSigner} enabled busy={false} run={run}
              operation={pending ? { version: 1, wallet: fixtureSigner.publicKey.toBase58(), genesis: fixtureClient.config.expectedGenesis,
                room: room.ledger.address.toBase58(), action: "Claim USDC", signature: "not-sent", runtime: "base", endpoint: "http://127.0.0.1:1", status: "pending" } : undefined} />}
          <TicketDisclosure title="Room & session controls" className="room-settings">{funding}</TicketDisclosure>
        </>}
      </div>
      <div className="fixture-chart" aria-hidden>Chart column height reference</div>
    </section>
    <output aria-label="Mock requests">{requests}</output>
  </main>;
}

createRoot(document.getElementById("root")!).render(<Fixture />);
