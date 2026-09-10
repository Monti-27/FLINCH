import { Wallet } from "lucide-react";
import { formatUnits } from "@flinch/client";
import { Button } from "../../components/ui/button.tsx";
import { AssetTicket } from "../../components/ui/asset-ticket.tsx";
import { TicketDisclosure } from "../../components/ui/ticket-disclosure.tsx";
import type { ClaimAsset, Withdrawal } from "./withdrawal-state.ts";
import styles from "./withdrawal.module.css";

export function WithdrawalTicket({ withdrawal, refund, disabled, loading, pending, onClaim }: {
  withdrawal: Withdrawal; refund: boolean; disabled: boolean; loading: boolean; pending: boolean; onClaim: (asset: ClaimAsset) => void;
}) {
  const { asset, amount } = withdrawal;
  const symbol = asset === "wsol" ? "WSOL" : "USDC";
  const wsol = asset === "wsol";
  const value = formatUnits(amount, wsol ? 9 : 6);
  return <article className={styles.ticket} aria-label={`${symbol} withdrawal`}>
    <AssetTicket label={refund ? "Your refund" : "Available to claim"} detail={wsol ? "Wrapped SOL" : "Test USDC"}
      symbol={symbol} amount={<span>{value}</span>} precise={value.length > 7} stacked={value.length > 13}>
      <div className={styles.route}><span>Room vault</span><span><Wallet size={14} aria-hidden />Your wallet</span></div>
    </AssetTicket>
    <Button className={styles.action} size="lg" disabled={disabled || pending} isLoading={loading} onClick={() => onClaim(asset)}>
      <span>Claim {symbol}</span>
    </Button>
    {(loading || pending) && <p role="status" className={styles.feedback}>{loading ? "Waiting for wallet and Solana confirmation…" : "Unconfirmed. Use Check transaction before trying again."}</p>}
  </article>;
}

export function WithdrawalDetails({ wrapped }: { wrapped: boolean }) {
  return <TicketDisclosure title="Withdrawal details" className={styles.details}>
    <p>Your wallet signs on Solana. Claims do not need a session key or MagicBlock.</p>
    {wrapped && <p>WSOL stays wrapped after claiming.</p>}
    <p>Your wallet pays the network fee and rent if a token account needs to be created.</p>
  </TicketDisclosure>;
}
