import { ArrowUpRight } from "lucide-react";
import { EcosystemIcon } from "../brand/ecosystem-icon.tsx";
import { NavigationRules } from "./navigation-rules.tsx";
import type { NavigationPanel } from "../../stores/ui-store.ts";

export const protocolLinks = [
  { title: "MagicBlock", icon: "magicblock", detail: "Live sell intents", href: "https://docs.magicblock.gg/" },
  { title: "Solana", icon: "solana", detail: "Custody & claims", href: "https://solana.com/docs" },
  { title: "Raydium", icon: "raydium", detail: "WSOL → USDC swaps", href: "https://docs.raydium.io/" },
] as const;

export function NavigationContent({ panel }: { panel: NavigationPanel }) {
  if (panel === "rules") return <NavigationRules />;
  return panel === "game" ? <div className="navigation-game">
    <div className="nav-introduction"><span className="nav-kicker">A game of nerve</span><p>Four enter. Who holds out?</p></div>
    <ol className="navigation-steps">
      <li><span>01</span><div><strong>Take a seat</strong><p>Four players. Equal stakes. One 90-second round.</p></div></li>
      <li><span>02</span><div><strong>Hold your nerve</strong><p>Hold, or sell and pay up to 0.25% to remaining holders.</p></div></li>
      <li><span>03</span><div><strong>Claim your share</strong><p>Keep unsold WSOL or claim USDC from a confirmed sale.</p></div></li>
    </ol>
  </div> : <div className="navigation-protocol">
    <div className="nav-introduction"><span className="nav-kicker">Under the hood</span><p>Every move has its place.</p></div>
    <div className="navigation-resources">{protocolLinks.map(link => <a key={link.title} href={link.href} target="_blank" rel="noreferrer">
      <span className="ecosystem-resource"><EcosystemIcon name={link.icon} size={24} /><span><strong>{link.title}</strong><small>{link.detail}</small></span></span><ArrowUpRight size={18} aria-hidden />
    </a>)}</div>
    <div className="navigation-note">An accepted SELL is an intent. Only a confirmed Solana swap completes a sale.</div>
  </div>;
}
