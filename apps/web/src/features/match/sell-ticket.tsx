import { ArrowDown } from "lucide-react";
import { formatUnits } from "@flinch/client";
import type { SellQuote } from "@flinch/client";
import { Button } from "../../components/ui/button.tsx";
import { AssetTicket } from "../../components/ui/asset-ticket.tsx";
import { TicketDisclosure } from "../../components/ui/ticket-disclosure.tsx";
import AnimatedNumberCounter from "../../components/ui/count-down-numbers.tsx";
import styles from "./sell-ticket.module.css";
import { Skeleton, SkeletonGroup } from "../../components/ui/skeleton.tsx";

type Props = {
  holding?: bigint; quote?: SellQuote; fresh: boolean; quoteIssue?: string; sessionReady: boolean;
  loading: boolean; busy: boolean; canQuote: boolean; canQueue: boolean;
  automatic?: boolean; failed?: boolean; paused?: boolean;
  onQuote: () => void; onQueue: () => void;
};

export function SellTicket({ holding, quote, fresh, quoteIssue, sessionReady, loading, busy, canQuote, canQueue, onQuote, onQueue,
  automatic = false, failed = false, paused = false }: Props) {
  const status = automatic ? busy ? "Checking price & approval…" : paused ? "Quote updates paused" : failed ? "Price unavailable. Retrying…"
    : "Quotes refresh automatically" : fresh ? "Fresh · valid up to 2s" : quoteIssue ?? "Quote unavailable";
  return <div className={styles.ticket} data-automatic={automatic}>
    {holding !== undefined && <AssetTicket label="You hold" detail="Current entitlement" symbol="WSOL"
      precise={formatUnits(holding, 9).length > 7} stacked={formatUnits(holding, 9).length > 13} amount={<AnimatedNumberCounter value={formatUnits(holding, 9)} />} />}
    {holding !== undefined && <div className={styles.connector} aria-hidden><ArrowDown size={14} /></div>}
    <AssetTicket label={quote ? "Estimated proceeds" : "You receive"} detail={quote ? "Raydium" : "Test USDC"} symbol="USDC" precise amount={
      quote ? <span className={styles.estimate}>{formatUnits(quote.outputLow, 6)}<span>to</span>{formatUnits(quote.outputHigh, 6)}</span>
        : loading ? <SkeletonGroup label="Reading pool reserves" className={styles.quoteLoading}><Skeleton width="100%" height="29px" /></SkeletonGroup>
          : <span className={styles.empty}>Get a quote</span>
    } />
    {quote ? <div className={`quote-breakdown ${styles.quote}`}>
      <dl className={styles.minimum}><dt>{automatic ? busy ? "Your approved minimum" : "Minimum you receive" : "Your signed minimum"}</dt><dd>{formatUnits(quote.minimumOutput, 6)} USDC</dd></dl>
      <Button size="lg" aria-label={`Queue SELL · ${sessionReady ? "session key" : "wallet approval"}`} aria-busy={busy} disabled={(!fresh && !automatic) || !canQueue || busy} onClick={onQueue}>Queue SELL</Button>
      <div className={styles.refresh}>
        <span role="status" data-tone={failed || !automatic && !fresh ? "expired" : "fresh"}>{status}</span>
        {(!automatic || failed) && <Button variant="secondary" size="sm" isLoading={loading} disabled={!canQuote || loading || busy} onClick={onQuote}>{automatic ? "Try again" : "Refresh quote"}</Button>}
      </div>
      <TicketDisclosure title="Fees & protection">
        <dl><dt>Maximum game penalty</dt><dd>{formatUnits(quote.penaltyMaximum, 9)} WSOL</dd><dt>Slippage allowance</dt><dd>{quote.slippageBps / 100}%</dd></dl>
        <p>Pool fees are included. Transaction fees are separate. Test liquidity, not the mainnet SOL/USD price.</p>
        <p>Sell and share up to 0.25% with remaining holders. No game penalty if all holders sell together.</p>
      </TicketDisclosure>
    </div> : <>
      <Button size="lg" className={styles.quoteAction} isLoading={loading} disabled={!canQuote || loading || busy} onClick={onQuote}>{loading ? "Reading pool reserves…" : "Get sell quote"}</Button>
      {automatic && failed && <p className={styles.note} role="status">Price unavailable. Retrying automatically.</p>}
    </>}
  </div>;
}
