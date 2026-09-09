import { PublicKey } from "@solana/web3.js";
import type { BaseRoom, Control } from "@flinch/client";
import { seatState } from "./state.ts";
import { EmptySeat, PlayerSeat } from "./player-seat.tsx";

export function Roster({ room, control, seat = -1, onOpenSeat }: { room?: BaseRoom; control?: Control; seat?: number; onOpenSeat?: () => void }) {
  const occupied = room?.ledger.wallets.filter(wallet => !wallet.equals(PublicKey.default)).length ?? 0;
  return (
    <section className="positions" aria-label="Four player positions">
      <p className="sr-only">{occupied} of 4 seats filled</p>
      <div className={`roster ${occupied === 0 ? "roster-empty" : ""}`}>
        {Array.from({ length: 4 }, (_, index) => {
          const wallet = room?.ledger.wallets[index];
          const empty = !wallet || wallet.equals(PublicKey.default);
          const holding = room?.ledger.economics?.holdings[index]
            ?? (empty || room?.ledger.refunded[index] ? 0n : room?.ledger.stake ?? 0n);
          const claim = room?.ledger.economics?.usdcClaims[index] ?? 0n;
          if (empty) return <EmptySeat key={index} index={index} onOpen={onOpenSeat} />;
          return <PlayerSeat key={`${room?.ledger.address}:${wallet}`} index={index} yours={seat === index} wallet={wallet.toBase58()}
            state={seatState(room!, index, control)} holding={holding} claim={claim} />;
        })}
      </div>
    </section>
  );
}
