import { Plus } from "lucide-react";
import { formatUnits } from "@flinch/client";
import { Address } from "../../components/address.tsx";
import { EcosystemIcon } from "../../components/brand/ecosystem-icon.tsx";
import AnimatedNumberCounter from "../../components/ui/count-down-numbers.tsx";

type SeatProps = {
  index: number; yours: boolean; wallet: string; state: string; holding: bigint; claim: bigint;
};

function SeatNumber({ index }: { index: number }) {
  return <span className="seat-number" aria-hidden>{String(index + 1).padStart(2, "0")}</span>;
}

export function EmptySeat({ index, onOpen }: { index: number; onOpen?: () => void }) {
  return <button type="button" className="player-slot" onClick={onOpen} disabled={!onOpen}
    aria-label={`Player ${index + 1}, open seat${onOpen ? ", view room entry" : ""}`}>
    <SeatNumber index={index} />
    <span className="slot-title">Open seat<span>Player {index + 1}</span></span>
    <span className="seat-plus" aria-hidden><Plus size={14} /></span>
  </button>;
}

export function PlayerSeat({ index, yours, wallet, state, holding, claim }: SeatProps) {
  return <article className={`roster-seat ${yours ? "your-seat" : ""}`}>
    <SeatNumber index={index} />
    <div className="seat-title"><h3>{yours ? "You" : `Player ${index + 1}`}</h3><p className="seat-label">{state}</p></div>
    <div className="seat-content"><Address value={wallet} label={`seat ${index + 1} wallet`} />
      {(holding > 0n || claim > 0n) && <div className="seat-assets">
        {holding > 0n && <span><EcosystemIcon name="solana" size={16} /><b><AnimatedNumberCounter value={formatUnits(holding, 9)} /></b> WSOL</span>}
        {claim > 0n && <span><EcosystemIcon name="usdc" size={16} /><b><AnimatedNumberCounter value={formatUnits(claim, 6)} /></b> USDC</span>}
      </div>}
    </div>
  </article>;
}
