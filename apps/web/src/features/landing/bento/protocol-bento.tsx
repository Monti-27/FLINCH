"use client";

import type { ComponentType } from "react";
import { BentoMotionProvider, useBentoScene } from "./bento-motion.tsx";
import type { SceneMotion } from "./bento-motion.tsx";
import type { SceneName } from "./bento-state.ts";
import { CustodyScene } from "./custody-scene.tsx";
import { RollupScene } from "./rollup-scene.tsx";
import { DecisionScene } from "./decision-scene.tsx";
import { HoldersScene } from "./holders-scene.tsx";
import { SettlementScene } from "./settlement-scene.tsx";
import { bentoThemeClasses } from "../theme/classes.ts";
import styles from "./bento.module.css";

const cards: { name: SceneName; title: string; text: string; Scene: ComponentType<SceneMotion> }[] = [
  { name: "custody", title: "Same stake. Same starting line.", text: "Four seats, equal WSOL. Your stake stays in a room vault on Solana.", Scene: CustodyScene },
  { name: "rollup", title: "Fast intents. Solana custody.", text: "Sell intents share a 2-second window on MagicBlock’s Ephemeral Rollup. Only Control moves; tokens stay on Solana.", Scene: RollupScene },
  { name: "decision", title: "A little nerve goes a long way.", text: "Hold automatically. Send a sell intent with your wallet or a temporary SELL-only session.", Scene: DecisionScene },
  { name: "holders", title: "They sell. You share the penalty.", text: "Up to 0.25% of a seller’s WSOL goes to holders outside the batch. All sell together? No game penalty.", Scene: HoldersScene },
  { name: "settlement", title: "A real swap. Then your wallet.", text: "Raydium swaps WSOL for USDC on Solana. A withdrawal is complete only after its transfer confirms.", Scene: SettlementScene },
];

function BentoCard({ card, index }: { card: typeof cards[number]; index: number }) {
  const scene = useBentoScene(card.name, index);
  return <article ref={scene.ref} className={styles.card} data-bento-card={card.name} data-phase={scene.phase} data-running={scene.running} data-cycle={scene.cycle}>
    <div className={styles.art} aria-hidden="true"><card.Scene phase={scene.phase} transition={scene.transition} /></div>
    <div className={styles.copy}><h3>{card.title}</h3><p>{card.text}</p></div>
  </article>;
}

function BentoContent() {
  return <section id="onchain" className={`${styles.section} ${bentoThemeClasses}`} aria-labelledby="settlement-title">
    <span id="how-it-works" className={styles.legacyAnchor} aria-hidden="true" />
    <header className={styles.introduction}>
      <p className={styles.eyebrow}>UNDER THE SURFACE</p>
      <h2 id="settlement-title">Fast where it matters.<br /><span>Settled where it counts.</span></h2>
      <p>The mechanics behind the nerves.</p>
    </header>
    <div className={styles.grid}>{cards.map((card, index) => <BentoCard card={card} index={index} key={card.name} />)}</div>
  </section>;
}

export function ProtocolBento() {
  return <BentoMotionProvider><BentoContent /></BentoMotionProvider>;
}
