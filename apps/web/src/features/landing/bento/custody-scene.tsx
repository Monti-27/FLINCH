import { motion } from "framer-motion";
import { EcosystemIcon } from "../../../components/brand/ecosystem-icon.tsx";
import type { SceneMotion } from "./bento-motion.tsx";
import styles from "./custody.module.css";

export function CustodyScene({ phase, transition }: SceneMotion) {
  const seated = [0, 2, 4, 4][phase];
  return <div className={styles.scene} data-custody-scene="" data-bento-contained="">
    <div className={styles.caption}><span>Room vault</span><span>On Solana</span></div>
    <div className={styles.asset} data-stake-asset="">
      <strong>WSOL</strong><span>Same amount.<br />Every seat.</span>
    </div>
    <div className={styles.tray}>
      <div className={styles.slots}>
        {[0, 1, 2, 3].map(index => <div className={styles.seat} key={index} data-stake-seat={index}>
          <div className={styles.socket} />
          <motion.div className={styles.chip} data-stake-chip={index} data-bento-contained="" initial={false}
            animate={{ y: index < seated ? 0 : -20 }} transition={transition(index)}>
            <EcosystemIcon name="solana" size={24} />
          </motion.div>
          <div className={styles.seatTrack}><motion.i data-stake-fill={index} initial={false}
            animate={{ scaleX: index < seated ? 1 : 0 }} transition={transition(index)} /></div>
        </div>)}
      </div>
      <div className={styles.trayEdge} />
    </div>
    <div className={styles.base}><span>4 equal stakes</span><span>One vault</span></div>
  </div>;
}
