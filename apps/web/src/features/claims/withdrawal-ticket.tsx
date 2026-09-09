import { ArrowUpRight, ChevronDown, Wallet } from "lucide-react";
import { formatUnits } from "@flinch/client";
import { Button } from "../../components/ui/button.tsx";
import { EcosystemIcon } from "../../components/brand/ecosystem-icon.tsx";
import type { ClaimAsset, Withdrawal } from "./withdrawal-state.ts";
import styles from "./withdrawal.module.css";

export function WithdrawalTicket({ withdrawal, refund, disabled, loading, pending, onClaim }: {
  withdrawal: Withdrawal; refund: boolean; disabled: boolean; loading: boolean; pending: boolean; onClaim: (asset: ClaimAsset) => void;
}) {
  const { asset, amount } = withdrawal;
  const symbol = asset.toUpperCase();
  const wsol = asset === "wsol";
  return <article className={styles.ticket} aria-label={`${symbol} withdrawal`}>
    <div className={styles.asset}><EcosystemIcon name={wsol ? "solana" : "usdc"} size={24} />
      <span>{wsol ? "Wrapped SOL" : "Test USDC"}</span><span className={styles.reason}>{refund ? "Refund" : wsol ? "Held" : "Sold"}</span>
    </div>
    <p className={styles.amount}><span>{formatUnits(amount, wsol ? 9 : 6)}</span><span>{symbol}</span></p>
    <div className={styles.route}><span>Room vault</span><span aria-hidden>→</span><span><Wallet size={14} aria-hidden />Your wallet</span></div>
    <Button className={styles.action} size="lg" disabled={disabled || pending} isLoading={loading} onClick={() => onClaim(asset)}>
      <span>Claim {symbol}</span><ArrowUpRight size={18} aria-hidden />
    </Button>
    {(loading || pending) && <p role="status" className={styles.feedback}>{loading ? "Waiting for wallet and Solana confirmation…" : "Unconfirmed. Use Check transaction before trying again."}</p>}
  </article>;
}

export function WithdrawalDetails({ wrapped }: { wrapped: boolean }) {
  return <details className={styles.details}>
    <summary>Withdrawal details<ChevronDown size={16} aria-hidden /></summary>
    <p>Your wallet signs on Solana. Claims do not need a session key or MagicBlock.</p>
    {wrapped && <p>WSOL stays wrapped after claiming.</p>}
    <p>Your wallet pays the network fee and rent if a token account needs to be created.</p>
  </details>;
}
