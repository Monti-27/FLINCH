import { Skeleton, SkeletonGroup } from "../../components/ui/skeleton.tsx";
import { EcosystemIcon } from "../../components/brand/ecosystem-icon.tsx";
import styles from "./market-skeleton.module.css";

export function MarketPriceSkeleton() {
  return <SkeletonGroup label="Loading reference price" className={`market-price ${styles.price}`}>
    <Skeleton width="104px" height="28px" /><Skeleton width="128px" height="18px" />
  </SkeletonGroup>;
}

export function ChartSkeleton({ label = "Loading SOL/USD price history" }: { label?: string }) {
  return <SkeletonGroup label={label} className={styles.chart}>
    <div className={styles.plot} aria-hidden="true"><Skeleton height="100%" /><span className={styles.message}>{label}…</span></div>
    <div className={styles.prices} aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} width="36px" height="10px" />)}</div>
    <div className={styles.times} aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} width="40px" height="10px" />)}</div>
  </SkeletonGroup>;
}

export function MarketSkeleton() {
  return <section className="market-panel" aria-label="Reference market">
    <div className="market-topline"><div className="market-heading">
      <div className="market-pair"><EcosystemIcon name="solana" /><h2>SOL <span>/ USD</span></h2><span className="caption">Coinbase spot</span></div>
      <MarketPriceSkeleton />
    </div><Skeleton width="64px" height="12px" /></div>
    <div className={`chart-toolbar ${styles.toolbar}`} aria-hidden="true">
      <Skeleton width="120px" height="32px" /><Skeleton width="100px" height="24px" />
      <div className="chart-utilities"><Skeleton width="32px" height="32px" /><Skeleton width="32px" height="32px" /></div>
    </div>
    <div className="chart-frame"><ChartSkeleton label="Starting reference chart" /></div>
    <div className="chart-footnote"><div className={styles.footerControl} aria-hidden="true"><Skeleton width="68px" height="12px" /></div>
      <span className="chart-reference-note">Reference only · not your sell price</span><span className="chart-timezone">UTC</span>
      <div className={styles.footerControl} aria-hidden="true"><Skeleton width="84px" height="12px" /></div>
    </div>
  </section>;
}
