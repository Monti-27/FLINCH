"use client";

import { useEffect, useId, useRef } from "react";
import { flushSync } from "react-dom";
import { ChevronDown, X, ArrowUpRight } from "lucide-react";
import { PublicKey } from "@solana/web3.js";
import type { BaseRoom, Control } from "@flinch/client";
import { Roster } from "../../features/match/roster.tsx";
import { useUi } from "../../providers/ui-provider.tsx";

type Props = { room?: BaseRoom; control?: Control; seat?: number; onOpenSeat?: () => void };

function SeatCount({ occupied }: { occupied: number }) {
  return <span className="seat-count"><span className="seat-count-marks" aria-hidden>{Array.from({ length: 4 }, (_, index) => <i key={index} data-filled={index < occupied} />)}</span><span>{occupied}<span className="seat-count-total"> / 4</span></span></span>;
}

export function RoomSidebar({ room, control, seat, onOpenSeat }: Props) {
  const mode = useUi(state => state.playerRail);
  const compact = useUi(state => state.compactPlayers);
  const dispatch = useUi(state => state.dispatchPlayerRail);
  const reduced = useUi(state => state.reducedMotion);
  const help = useUi(state => state.setHelpOpen);
  const root = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const id = useId();
  const open = !compact || mode !== "closed";
  const occupied = room?.ledger.wallets.filter(wallet => !wallet.equals(PublicKey.default)).length ?? 0;
  const dismiss = (restore = false) => {
    flushSync(() => dispatch("dismiss"));
    if (restore && compact) trigger.current?.focus();
  };
  useEffect(() => {
    if (!compact || mode !== "open") return;
    const frame = requestAnimationFrame(() => close.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [mode, compact]);
  useEffect(() => {
    if (!compact || !open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) dispatch("dismiss");
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      flushSync(() => dispatch("dismiss"));
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [compact, open, dispatch]);
  return <aside ref={root} className="player-rail" aria-label="Players and round rules"
    data-expanded={open} data-motion={reduced ? "reduced" : "full"}
    onBlur={event => {
      if (compact && event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) dispatch("dismiss");
    }}>
    <button ref={trigger} className="rail-peek" type="button" aria-label={`Show players, ${occupied} of 4 seats filled`}
      aria-expanded={open} aria-controls={id} onClick={() => dispatch(open ? "dismiss" : "open")}>
      <span>Players</span><SeatCount occupied={occupied} /><ChevronDown size={16} aria-hidden />
    </button>
    <div className="rail-content" id={id} inert={!open} aria-hidden={!open}>
      <header className="rail-heading"><h2>Players</h2><SeatCount occupied={occupied} />
        <button ref={close} type="button" className="icon-button rail-close" aria-label="Hide players" onClick={() => dismiss(true)}><X size={16} aria-hidden /></button>
      </header>
      <Roster room={room} control={control} seat={seat} onOpenSeat={onOpenSeat ? () => { dismiss(); onOpenSeat(); } : undefined} />
      <div className="rail-footer">
        <button type="button" className="text-button" onClick={() => { dismiss(true); help(true); }}>How the round works<ArrowUpRight size={14} aria-hidden /></button>
      </div>
    </div>
  </aside>;
}
