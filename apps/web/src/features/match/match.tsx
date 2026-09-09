"use client";

import { useEffect, useRef, useState } from "react";
import type { FlinchClient, TransactionSigner } from "@flinch/client";
import { useRoom } from "./use-room.ts";
import { Standoff } from "./standoff.tsx";
import { estimatedTime, ROUND_DURATION_MS } from "./timer-state.ts";
import { Sell } from "./sell.tsx";
import { Funding } from "../lobby/funding.tsx";
import { Claims } from "../claims/claims.tsx";
import { withdrawalState } from "../claims/withdrawal-state.ts";
import { Receipts } from "../proof/receipts.tsx";
import type { Session } from "../../lib/session.ts";
import type { ActionRequest } from "../../lib/use-actions.ts";
import type { Operation } from "../../lib/operation.ts";
import { ArenaWorkspace } from "../../components/shell/arena-workspace.tsx";
import { RoomSidebar } from "../../components/shell/room-sidebar.tsx";
import { ActionSkeleton, OverviewSkeleton, PlayersSkeleton } from "../../components/shell/arena-skeleton.tsx";
import { TicketDisclosure } from "../../components/ui/ticket-disclosure.tsx";

export function Match({ client, address, signer, enabled, busy, operation, run }: { client: FlinchClient; address: string;
  signer?: TransactionSigner; enabled: boolean; busy: boolean; operation?: Operation; run: (request: ActionRequest) => Promise<unknown> }) {
  const view = useRoom(client, address);
  const [wallTime, setWallTime] = useState(Date.now());
  const [session, setSession] = useState<Session>();
  const entry = useRef<HTMLDivElement>(null);
  useEffect(() => { const timer = setInterval(() => setWallTime(Date.now()), 250); return () => clearInterval(timer); }, []);
  const room = view.room;
  if (view.loading) return <ArenaWorkspace overview={<OverviewSkeleton />} players={<PlayersSkeleton />}><ActionSkeleton room /></ArenaWorkspace>;
  if (!room) return <section className="panel brand-message" role="alert"><h2>Room unavailable</h2><p>{view.error ?? "Enter a room address to begin."}</p><p className="muted">Check the network and address. Reads retry automatically; no transaction is sent.</p></section>;
  const seat = signer ? room.ledger.wallets.findIndex(key => key.equals(signer.publicKey)) : -1;
  const elapsed = BigInt(Math.max(0, Math.floor((wallTime - view.observedAt) / 1000)));
  const remainingMs = BigInt(room.ledger.economics ? estimatedTime(room.ledger.economics.startedAt, room.now, view.observedAt, wallTime) : ROUND_DURATION_MS);
  const stale = wallTime - view.observedAt > 5000;
  const controlNow = view.controlNow === undefined ? room.now : view.controlNow + BigInt(Math.max(0, Math.floor((wallTime - (view.controlObservedAt ?? wallTime)) / 1000)));
  const controls = <Funding client={client} room={room} signer={signer} session={session} remember={setSession} busy={busy} enabled={enabled} run={run} />;
  return <ArenaWorkspace
    overview={<Standoff room={room} control={view.control} seat={seat} remainingMs={remainingMs} stale={stale} />}
    players={<RoomSidebar room={room} control={view.control} seat={seat} onOpenSeat={room.ledger.phase === "funding" ? () => entry.current?.focus() : undefined} />}
    notice={(view.error || stale) && <p role="status" className="notice">{view.error ?? "Waiting for fresh chain state. SELL is paused."} Base claims and recovery remain separate.</p>}
    history={<><Receipts client={client} room={room} /><p className="chain-observation">Solana state confirmed at slot {room.slot}. Updated {elapsed.toString()}s ago.</p></>}
  >
        <div ref={entry} className="room-controls" tabIndex={-1} aria-label="Room actions">
          {room.ledger.phase !== "funding" && <>
            {!withdrawalState(room, seat).replacesPosition && <Sell client={client} room={room} control={stale || view.error ? undefined : view.control} seat={seat} wallet={signer}
              controlNow={controlNow} session={session} busy={busy} enabled={enabled} wallTime={wallTime} run={run} />}
            <Claims client={client} room={room} seat={seat} signer={signer} busy={busy} enabled={enabled} operation={operation} run={run} />
          </>}
          {room.ledger.phase === "funding" ? controls : <TicketDisclosure className="room-settings" title="Room & session controls">{controls}</TicketDisclosure>}
        </div>
  </ArenaWorkspace>;
}
