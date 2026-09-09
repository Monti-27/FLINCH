import { PublicKey } from "@solana/web3.js";
import type { BaseRoom, Control } from "@flinch/client";
import { Address } from "../../components/address.tsx";
import { roomStatus } from "./state.ts";
import { RoundTimer } from "./round-timer.tsx";
import type { TimerObservation } from "./countdown-clock.ts";
import styles from "./standoff.module.css";

type Props = { room?: BaseRoom; control?: Control; seat?: number; remaining?: bigint; remainingMs?: bigint; stale?: boolean; timerObservation?: TimerObservation };

function headline(room: BaseRoom | undefined, seat: number) {
  if (!room) return "Who sells first?";
  if (room.ledger.phase === "cancelled") return "Room cancelled";
  const economics = room.ledger.economics;
  if (!economics) return "Waiting for players";
  if (economics.terminalTag === 1) return economics.terminalSeat === seat ? "You held last" : `Player ${economics.terminalSeat + 1} held last`;
  if (economics.terminalTag === 2) return "Everyone sold";
  return economics.terminalTag ? "Round complete" : "Round in progress";
}

function phaseLabel(room: BaseRoom | undefined, ended: boolean) {
  if (!room) return "Four players. One standoff.";
  if (room.ledger.phase === "cancelled") return "Cancelled";
  if (ended) return "Final";
  return room.ledger.economics ? "Live round" : "Lobby";
}

export function Standoff({ room, control, seat = -1, remaining = 90n, remainingMs = remaining * 1000n, stale = false, timerObservation }: Props) {
  const occupied = room?.ledger.wallets.filter(wallet => !wallet.equals(PublicKey.default)).length ?? 0;
  const ended = !!room?.ledger.economics?.terminalTag || room?.ledger.phase === "cancelled";
  const funding = !room?.ledger.economics && !ended;
  return <section className={`standoff ${styles.bar}`} data-room={!!room} aria-label="Round overview">
    <div className={styles.identity}>
      <span className={styles.eyebrow}>{phaseLabel(room, ended)}</span>
      <h1>{headline(room, seat)}</h1>
      {room ? <div className={styles.meta}><span>{roomStatus(room, control)}</span><span className={styles.address}><Address value={room.ledger.address.toBase58()} label="room address" /></span></div>
        : <p>Sell first. Pay the holders.</p>}
    </div>
    <div className={styles.stats}>
      <span className="sr-only">{occupied} / 4 seats filled</span>
      <RoundTimer key={room?.ledger.address.toBase58() ?? "lobby"} milliseconds={remainingMs} funding={funding} ended={ended} stale={stale} observation={timerObservation} />
    </div>
  </section>;
}
