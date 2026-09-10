import { HelpCircle } from "lucide-react";
import { RevealWords } from "./reveal-words.tsx";
import { ProtocolBento } from "./bento/protocol-bento.tsx";
import { FaqAccordion } from "./faq-accordion.tsx";
import styles from "./details.module.css";

export const questions = [
  { question: "Am I playing with real money?", answer: "No. The FLINCH program is deployed on Solana Devnet. Test SOL and test USDC have no monetary value. Read-only previews cannot create or fund rooms; onchain play requires a transaction-enabled build. Localnet is a separate local sandbox. Never send mainnet assets." },
  { question: "What happens when I press sell?", answer: "You approve a sell intent with a minimum USDC output. MagicBlock groups intents in two-second windows. Control returns to Solana for a Raydium swap. Only a successful base-layer swap changes your WSOL into claimable USDC; acceptance alone is not a sale. Handoffs can pause new sells while the round timer continues." },
  { question: "What if everyone sells together?", answer: "Players in the same sell batch never receive each other’s penalties. If no holder remains outside the batch, the game penalty is zero. Each seller receives their share of the actual USDC output. Network and DEX fees are separate." },
  { question: "What if the round gets stuck?", answer: "Failed or expired swaps charge no game penalty. At 30 seconds after the round ends, base-layer recovery can close the round without MagicBlock or the DEX. Unsold WSOL and earlier USDC proceeds remain claimable by their owners. Solana outages can still delay recovery and withdrawals." },
  { question: "Does the final holder win the entire pot?", answer: "No. The final holder keeps their own WSOL entitlement plus their share of penalties from successful sellers. Multiple holders at timeout each keep their entitlements. There is no forced winner or confiscation of other players’ stakes." },
] as const;

export function LandingDetails() {
  return <>
    <ProtocolBento />
    <section id="questions" className={styles.questions} aria-labelledby="questions-title">
      <div className={styles.introduction}>
        <p className={styles.kicker}><HelpCircle size={13} aria-hidden />FAQ</p>
        <h2 id="questions-title" data-reveal=""><RevealWords>A few things before you flinch.</RevealWords></h2>
        <p data-reveal="" data-delay="80">Short game. Nothing hidden in the fine print.</p>
      </div>
      <FaqAccordion questions={questions} />
    </section>
  </>;
}
