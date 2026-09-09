import { Skeleton } from "../../components/ui/skeleton.tsx";
import styles from "./stake-control.module.css";
import loading from "./stake-skeleton.module.css";

export function StakeSkeleton() {
  return <div className={`token-input ${styles.control}`} aria-hidden="true">
    <div className={styles.heading}><Skeleton width="92px" height="18px" /><Skeleton width="88px" height="18px" /></div>
    <div className={styles.valueRow}><Skeleton width="76px" height="40px" round /><div className={`token-input-value ${styles.amount} ${loading.amount}`}><Skeleton width="112px" height="40px" /></div></div>
    <div className={styles.adjustment}><Skeleton width="44px" height="44px" round /><div className={styles.range}><Skeleton height="4px" /></div><Skeleton width="44px" height="44px" round /></div>
    <div className={styles.presets}>{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} height="40px" />)}</div>
  </div>;
}
