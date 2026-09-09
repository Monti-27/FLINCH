import { motion } from "framer-motion";
import type { SceneMotion } from "./bento-motion.tsx";
import styles from "./scenes.module.css";

export function DecisionScene({ phase, transition }: SceneMotion) {
  const sell = phase === 1 || phase === 2;
  return <div className={styles.decision}>
    <div className={styles.decisionHeading}><span>Your move</span><span>90 seconds</span></div>
    <div className={styles.decisionClock}>01:30</div>
    <div className={styles.keys}>
      <motion.div className={styles.holdKey} initial={false} animate={{ y: sell ? 5 : -6, rotate: sell ? -9 : -4, scale: sell ? 0.95 : 1 }} transition={transition()}>
        <span>HOLD</span><small>Do nothing.</small>
      </motion.div>
      <motion.div className={styles.sellKey} initial={false} animate={{ y: sell ? -12 : 4, rotate: sell ? 3 : 9, scale: sell ? 1 : 0.95 }} transition={transition()}>
        <span>SELL</span><small>Make a move.</small>
      </motion.div>
    </div>
    <div className={styles.sessionTag}><span className={styles.keyGlyph} />Wallet or SELL-only session</div>
  </div>;
}
