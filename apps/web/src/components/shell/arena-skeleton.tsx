import { BrandLogo } from "../brand/logo.tsx";
import { Skeleton, SkeletonGroup } from "../ui/skeleton.tsx";
import { ArenaLayout } from "./arena-layout.tsx";
import { MarketSkeleton } from "../../features/market/market-skeleton.tsx";
import overview from "../../features/match/standoff.module.css";
import timer from "../../features/match/round-timer.module.css";
import styles from "./arena-skeleton.module.css";
import { StakeSkeleton } from "../../features/lobby/stake-skeleton.tsx";
import terms from "../../features/lobby/round-terms.module.css";

export function OverviewSkeleton() {
  return <SkeletonGroup label="Loading round overview" className={`standoff ${overview.bar}`}>
    <div className={`${overview.identity} ${styles.identity}`} aria-hidden="true">
      <Skeleton width="144px" height="16px" /><Skeleton width="300px" height="1.1em" className={styles.title} /><Skeleton width="200px" height="20px" />
    </div>
    <div className={timer.timer} aria-hidden="true"><Skeleton width="84px" height="17px" />
      <div className={timer.readout}><Skeleton width="var(--dial-size)" height="var(--dial-size)" round className={styles.dial} /><Skeleton width="1.5em" height="1em" className={timer.number} /></div>
    </div>
  </SkeletonGroup>;
}

export function PlayersSkeleton() {
  return <SkeletonGroup label="Loading player seats" className={`player-rail ${styles.players}`}>
    <div className={styles.compact} aria-hidden="true"><Skeleton width="68px" height="14px" /><Skeleton width="44px" height="14px" /></div>
    <div className={styles.desktop} aria-hidden="true">
      <div className={styles.playerHeading}><Skeleton width="88px" height="14px" /><Skeleton width="156px" height="14px" /></div>
      <div className="roster">{Array.from({ length: 4 }, (_, index) => <div className={`player-slot ${styles.seat}`} key={index}>
        <Skeleton width="40px" height="40px" /><div className={styles.seatText}><Skeleton width="76px" height="14px" /><Skeleton width="48px" height="12px" /></div><Skeleton width="28px" height="28px" round className={styles.seatPlus} />
      </div>)}</div>
    </div>
  </SkeletonGroup>;
}

export function ActionSkeleton({ room = false }: { room?: boolean }) {
  return <SkeletonGroup label={room ? "Reading room and its Solana balances" : "Loading room entry"} className={`room-entry ${styles.action}`}>
    <div className="lobby-section" aria-hidden="true">
      <div className="entry-header"><div className={styles.entryHeader}><Skeleton width="46%" height="40px" /><Skeleton width="46%" height="40px" /></div></div>
      <div className="create-room">
        <StakeSkeleton />
        <div className={terms.terms}><div className={`${terms.trigger} ${styles.terms}`}><Skeleton width="72px" height="14px" /><Skeleton width="56px" height="14px" /></div></div>
        <div className="entry-footer"><p className="field-help">Your stake is deposited when you join.</p><Skeleton height="48px" className={styles.actionButton} /></div>
        <div className={`availability ${styles.availability}`}><Skeleton width="176px" height="14px" /></div>
      </div>
    </div>
  </SkeletonGroup>;
}

export function ArenaSkeleton() {
  return <div className="app-frame" data-arena-loading="">
    <header className="app-header"><div className="header-brand"><a href="/" className="header-logo" aria-label="FLINCH home"><BrandLogo /></a></div>
      <div className={`notched-navigation ${styles.navigation}`} aria-hidden="true"><Skeleton width="384px" height="44px" /></div>
      <div className="header-actions"><Skeleton width="150px" height="40px" /></div>
    </header>
    <div className="safety-strip"><Skeleton width="260px" height="12px" /><Skeleton width="300px" height="12px" /></div>
    <main aria-label="Loading FLINCH arena"><span className="sr-only" role="status">Loading FLINCH…</span>
      <ArenaLayout overview={<OverviewSkeleton />} players={<PlayersSkeleton />} market={<MarketSkeleton />}><ActionSkeleton /></ArenaLayout>
    </main>
  </div>;
}
