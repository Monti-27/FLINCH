import { formatUnits } from "@flinch/client";
import { AssetTicket } from "../../components/ui/asset-ticket.tsx";
import { Button } from "../../components/ui/button.tsx";
import { TicketDisclosure } from "../../components/ui/ticket-disclosure.tsx";
import styles from "./funding.module.css";

type Props = {
  stake: bigint; joined: boolean; seat: number; occupied: number; expired: boolean; disabled: boolean; busy: boolean;
  useSession: boolean; setUseSession: (enabled: boolean) => void; onJoin: () => void;
};

export function FundingTicket({ stake, joined, seat, occupied, expired, disabled, busy, useSession, setUseSession, onJoin }: Props) {
  const amount = formatUnits(stake, 9);
  const full = occupied === 4;
  const waiting = full ? "All four seats are filled." : `Waiting for ${4 - occupied} more ${occupied === 3 ? "player" : "players"}.`;
  return <>
    <header className={styles.header}><h2>{expired ? "Entry closed" : joined ? "You’re in" : full ? "Room full" : "Take your seat"}</h2>
      <p>{expired ? "The funding window has ended." : joined ? waiting : "Four equal stakes. One 90-second standoff."}</p>
    </header>
    <AssetTicket label={joined ? "Your stake" : "Stake per player"} detail={joined ? "Deposited" : "Equal for all four"}
      symbol={joined ? "WSOL" : "SOL"} amount={amount} precise={amount.length > 7}>
      <dl className={styles.facts}><div><dt>{joined ? "Your seat" : "Open seats"}</dt><dd>{joined ? `Player ${seat + 1}` : `${4 - occupied} of 4`}</dd></div>
        <div><dt>{joined ? "Players joined" : "Sell penalty"}</dt><dd>{joined ? `${occupied} of 4` : "Up to 0.25%"}</dd></div></dl>
    </AssetTicket>
    {!joined && !full && !expired && <>
      <div className={styles.session}>
        <label className={styles.toggle}><span>Quick SELL session<span>Fewer wallet prompts during the round</span></span>
          <input type="checkbox" aria-label="Enable a temporary SELL session" checked={useSession} disabled={busy} onChange={event => setUseSession(event.target.checked)} />
        </label>
        <TicketDisclosure title="Session permissions & costs">
          <p>The session lasts ten minutes and can only queue SELL for this seat. It cannot move your wallet tokens or claim.</p>
          <p>Top-up is the network’s rent-exempt minimum plus 0.0001 SOL for fees; session-account rent is separate. The key disappears on reload.</p>
        </TicketDisclosure>
      </div>
      <Button className={styles.join} size="lg" isLoading={busy} disabled={disabled || full || expired} onClick={onJoin}
        aria-label={`Join · ${amount} SOL`}>{busy ? "Securing your seat…" : "Join round"}</Button>
      <p className={styles.note}>Deposit and seat are confirmed together on Solana. Network fees and account rent are extra.</p>
    </>}
    {joined && <p className={styles.note}>{expired ? "Cancel the room to make deposited stakes refundable." : full ? "The round starts after Solana confirmation and verified MagicBlock placement." : "Your seat is confirmed. Share the room invite to fill the remaining seats."}</p>}
  </>;
}
