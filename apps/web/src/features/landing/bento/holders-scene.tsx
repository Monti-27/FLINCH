import { motion } from "framer-motion";
import type { SceneMotion } from "./bento-motion.tsx";
import styles from "./scenes.module.css";

export function HoldersScene({ phase, transition }: SceneMotion) {
  const distributed = phase >= 2;
  return <div className={styles.holders}>
    <div className={styles.holderHeading}><div><small>Seller penalty · up to</small><strong>0.25<span>%</span></strong></div><span>Schematic · not to scale</span></div>
    <div className={styles.shareLabels}><span data-selected={!distributed}>Before a sale</span><span data-selected={distributed}>After a sale</span></div>
    <div className={styles.sharePlot}>
      {[0, 1, 2, 3].map(index => <div className={styles.shareColumn} key={index}>
        <div className={styles.shareTrack}>
          <motion.div className={styles.shareFill} data-seller={index === 0} initial={false}
            animate={{ scaleY: index === 0 ? phase >= 1 ? 0.14 : 0.62 : distributed ? 0.9 : 0.62 }} transition={transition(index)} />
          {index > 0 && <motion.div className={styles.shareBonus} initial={false} animate={{ opacity: distributed ? 1 : 0, y: distributed ? 0 : -14 }} transition={transition(index)}><span>+</span></motion.div>}
        </div>
        <span>{index === 0 ? "Seller" : `Holder ${index}`}</span>
      </div>)}
    </div>
  </div>;
}
