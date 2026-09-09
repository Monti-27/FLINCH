import { ChevronDown } from "lucide-react";

const steps = [
  { title: "Take your seat", body: "Four players fund equal stakes of 0.001–0.01 test SOL, wrapped to WSOL. A full room can start." },
  { title: "Hold or sell", body: "Do nothing to hold. Choose SELL to exchange your WSOL for USDC through Raydium." },
  { title: "Sellers pay the holders", body: "A successful seller pays up to 0.25% of their current WSOL to holders outside the same sell batch." },
  { title: "Claim what’s yours", body: "The last holder keeps their WSOL. With several holders at timeout, each keeps their share. Sellers claim USDC." },
];

export function HelpContent() {
  return <>
    <div className="rules-facts" aria-label="Round at a glance">
      <div><strong>4</strong><span>Players</span></div>
      <div><strong>90<span>s</span></strong><span>Per round</span></div>
      <div><strong>Equal</strong><span>Starting stakes</span></div>
    </div>
    <ol className="rules-list">{steps.map((step, index) => <li key={step.title}>
      <span className="rule-number" aria-hidden>{String(index + 1).padStart(2, "0")}</span>
      <div><h3>{step.title}</h3><p>{step.body}</p></div>
    </li>)}</ol>
    <div className="rules-settlement"><strong>Queued isn’t sold.</strong><p>A sale is complete only after the Solana swap confirms. A failed or expired swap charges no game penalty.</p></div>
    <details className="rules-details"><summary>The finer details<ChevronDown size={16} aria-hidden /></summary>
      <div><p>Sells are grouped in two-second batches. Sellers in the same batch never pay each other. If every holder sells in one batch, the penalty is zero.</p>
        <p>The timer keeps running during settlement. If settlement stalls, recovery is available 30 seconds after the round ends. Unsold WSOL and earlier USDC proceeds remain yours to claim.</p>
        <p>Reference prices are not executable quotes. Network fees, DEX fees and account rent are separate.</p></div>
    </details>
  </>;
}
