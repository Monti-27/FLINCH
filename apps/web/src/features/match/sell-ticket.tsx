import { ArrowDown, ArrowUpRight, ChevronDown } from "lucide-react";
import { formatUnits } from "@flinch/client";
import type { SellQuote } from "@flinch/client";
import { Button } from "../../components/ui/button.tsx";
import { EcosystemIcon } from "../../components/brand/ecosystem-icon.tsx";
import AnimatedNumberCounter from "../../components/ui/count-down-numbers.tsx";
import styles from "./sell-ticket.module.css";
import { Skeleton, SkeletonGroup } from "../../components/ui/skeleton.tsx";

type Props = {
  holding?: bigint; quote?: SellQuote; fresh: boolean; quoteIssue?: string; sessionReady: boolean;
  loading: boolean; busy: boolean; canQuote: boolean; canQueue: boolean;
  onQuote: () => void; onQueue: () => void;
};

export function SellTicket({ holding, quote, fresh, quoteIssue, sessionReady, loading, busy, canQuote, canQueue, onQuote, onQueue }: Props) {
  return <div className={styles.ticket}>
    {holding !== undefined && <div className={`position-balance ${styles.balance}`}>
      <div className={styles.asset}><EcosystemIcon name="solana" size={24} /><span>Wrapped SOL</span><span className={styles.symbol}>WSOL</span></div>
      <span className="caption">Current entitlement</span>
      <p><strong><AnimatedNumberCounter value={formatUnits(holding, 9)} /></strong><span>WSOL</span></p>
    </div>}
    <div className={styles.connector} aria-hidden><ArrowDown size={16} /></div>
    <div className={styles.receive} data-quoted={!!quote}>
      <div className={styles.asset}><EcosystemIcon name="usdc" size={24} /><span>Test USDC</span><span className={styles.symbol}>Receive</span></div>
      {quote && <p className={styles.estimate}>{formatUnits(quote.outputLow, 6)}<span>–</span>{formatUnits(quote.outputHigh, 6)}</p>}
      {quote && <span className="caption">Estimated proceeds · Raydium</span>}
      {!quote && loading && <SkeletonGroup label="Reading pool reserves" className={styles.quoteLoading}>
        <Skeleton width="80%" height="29px" /><Skeleton width="68%" height="18px" />
      </SkeletonGroup>}
    </div>
    {quote ? <div className={`quote-breakdown ${styles.quote}`}>
      <dl className={styles.minimum}><dt>Your signed minimum</dt><dd>{formatUnits(quote.minimumOutput, 6)} USDC</dd></dl>
      <Button size="lg" disabled={!fresh || !canQueue || busy} onClick={onQueue}>Queue SELL · {sessionReady ? "session key" : "wallet approval"}<ArrowUpRight size={16} aria-hidden /></Button>
      <div className={styles.refresh}>
        <span data-tone={fresh ? "fresh" : "expired"}>{fresh ? "Fresh · valid up to 2s" : quoteIssue ?? "Quote unavailable"}</span>
        <Button variant="secondary" size="sm" isLoading={loading} disabled={!canQuote || loading || busy} onClick={onQuote}>Refresh quote</Button>
      </div>
      <details className={styles.details}>
        <summary>Fees & protection<ChevronDown size={14} aria-hidden /></summary>
        <dl><dt>Maximum game penalty</dt><dd>{formatUnits(quote.penaltyMaximum, 9)} WSOL</dd><dt>Slippage allowance</dt><dd>{quote.slippageBps / 100}%</dd></dl>
        <p>Pool fees are included. Transaction fees are separate. Test liquidity, not the mainnet SOL/USD price.</p>
      </details>
    </div> : <Button size="lg" className={styles.quoteAction} isLoading={loading} disabled={!canQuote || loading || busy} onClick={onQuote}>{loading ? "Reading pool reserves…" : "Get sell quote"}<ArrowUpRight size={16} aria-hidden /></Button>}
  </div>;
}
