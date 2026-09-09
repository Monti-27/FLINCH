import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { EcosystemIcon } from "../../../components/brand/ecosystem-icon.tsx";
import type { SceneMotion } from "./bento-motion.tsx";
import styles from "./scenes.module.css";

export function SettlementScene({ phase, transition }: SceneMotion) {
  const claim = phase >= 2;
  return <div className={styles.settlement}>
    <motion.div className={styles.ledgerSheet} initial={false} animate={{ opacity: claim ? 0.35 : 1, scale: claim ? 0.96 : 1 }} transition={transition()}>
      <div className={styles.ledgerHeading}><span>Asset</span><span>Where it goes</span></div>
      <div className={styles.ledgerRow}><EcosystemIcon name="solana" size={20} /><strong>WSOL</strong><span>Room vault</span></div>
      <div className={styles.ledgerRow}><EcosystemIcon name="raydium" size={20} /><strong>Raydium</strong><span>Base-layer swap</span></div>
      <div className={styles.ledgerRow}><EcosystemIcon name="usdc" size={20} /><strong>USDC</strong><span>Your proceeds</span></div>
    </motion.div>
    <motion.div className={styles.withdrawalSheet} initial={false} animate={{ y: claim ? 0 : 96, opacity: claim ? 1 : 0, scale: claim ? 1 : 0.94 }} transition={transition()}>
      <span>After a confirmed swap</span>
      <div className={styles.tokenJourney}><span><EcosystemIcon name="solana" size={24} /></span><ArrowRight size={16} /><span><EcosystemIcon name="usdc" size={24} /></span></div>
      <strong>Back to your wallet.</strong>
      <div className={styles.withdrawalKey}>Claim USDC<ArrowRight size={14} /></div>
    </motion.div>
  </div>;
}
