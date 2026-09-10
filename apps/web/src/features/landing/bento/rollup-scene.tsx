import { motion } from "framer-motion";
import { EcosystemIcon } from "../../../components/brand/ecosystem-icon.tsx";
import type { SceneMotion } from "./bento-motion.tsx";
import { rollupThemeClasses } from "../theme/classes.ts";
import styles from "./rollup.module.css";

export function RollupScene({ phase, transition }: SceneMotion) {
  const returning = phase >= 3;
  return <div className={`${styles.scene} ${rollupThemeClasses}`} data-rollup-scene="" data-rollup-step={phase} data-bento-contained="">
    <div className={styles.heading} data-bento-contained="">
      <span className={styles.brand}><EcosystemIcon name="magicblock" size={24} /></span>
      <div><strong>MagicBlock</strong><small>Ephemeral Rollup</small></div>
    </div>
    <div className={styles.bridge}>
      <span className={styles.rail} data-rollup-rail="" /><span className={styles.rail} data-rollup-rail="" />
      <div className={styles.backplate} data-rollup-backplate="" />
      <motion.div className={styles.control} data-rollup-packet="" data-bento-contained="" initial={false}
        animate={{ y: returning ? 16 : 0 }} transition={transition()}>
        <div className={styles.controlHeading}><strong>Control account</strong><span>↓</span></div>
        <div className={styles.records}>
          {[0, 1, 2].map(index => <div className={styles.record} key={index} data-rollup-intent={index}>
            <motion.i initial={false} animate={{ scaleX: phase >= 2 ? 1 : phase >= 1 ? .65 : .12 }} transition={transition(index)} />
          </div>)}
        </div>
        <div className={styles.steps}>
          {["Queue", "Batch", "Return"].map((label, index) => <span key={label}>
            <motion.i data-rollup-highlight="" initial={false} animate={{ opacity: index === Math.max(0, phase - 1) ? 1 : 0 }} transition={transition()} />
            <span>{label}</span>
          </span>)}
        </div>
      </motion.div>
    </div>
    <div className={styles.custody} data-rollup-custody="" data-bento-contained="">
      <EcosystemIcon name="solana" size={20} /><strong>Solana</strong><span>Token custody</span>
    </div>
  </div>;
}
