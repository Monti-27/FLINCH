import { ArrowUpRight } from "lucide-react";
import { EcosystemIcon } from "../brand/ecosystem-icon.tsx";

export const protocolLinks = [
  { title: "MagicBlock", icon: "magicblock", detail: "Live sell intents", href: "https://docs.magicblock.gg/" },
  { title: "Solana", icon: "solana", detail: "Custody & claims", href: "https://solana.com/docs" },
  { title: "Raydium", icon: "raydium", detail: "WSOL → USDC swaps", href: "https://docs.raydium.io/" },
] as const;

export function NavigationContent({ panel }: { panel: "game" | "protocol" }) {
  return panel === "game" ? <div className="navigation-game">
    <div className="nav-introduction"><span className="nav-kicker">A game of nerve</span><p>Four enter.<br />Who holds out?</p><span>Equal stakes. Real choices.</span></div>
    <ol className="navigation-steps">
      <li><span>01</span><div><strong>Take a seat</strong><p>Four wallets stake equal test SOL.</p></div></li>
      <li><span>02</span><div><strong>Hold or sell</strong><p>A successful seller pays up to 0.25% to remaining holders.</p></div></li>
      <li><span>03</span><div><strong>Claim your share</strong><p>Unsold WSOL stays yours. Successful sales return test USDC.</p></div></li>
    </ol>
    <div className="navigation-note">90-second rounds · No protocol fee · Test tokens only</div>
  </div> : <div className="navigation-protocol">
    <div className="nav-introduction"><span className="nav-kicker">Under the hood</span><p>Fast decisions.<br />Onchain settlement.</p></div>
    <div className="navigation-resources">{protocolLinks.map(link => <a key={link.title} href={link.href} target="_blank" rel="noreferrer">
      <span className="ecosystem-resource"><EcosystemIcon name={link.icon} size={24} /><span><strong>{link.title}</strong><small>{link.detail}</small></span></span><ArrowUpRight size={18} aria-hidden />
    </a>)}</div>
    <div className="navigation-note">An accepted SELL is an intent. Only a confirmed Solana swap completes a sale.</div>
  </div>;
}
