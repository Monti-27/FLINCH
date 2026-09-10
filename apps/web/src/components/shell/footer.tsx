"use client";

import { ArrowUpRight, ArrowUp } from "lucide-react";
import type { WebConfig } from "../../lib/config.ts";
import { useUi } from "../../providers/ui-provider.tsx";
import { protocolLinks } from "./navigation-content.tsx";
import { FooterHands } from "./footer-hands.tsx";
import { BrandLogo } from "../brand/logo.tsx";
import { EcosystemIcon } from "../brand/ecosystem-icon.tsx";

export function Footer({ config, arenaHref, theme = "dark" }: { config: Pick<WebConfig, "network" | "transactions">; arenaHref?: "/play"; theme?: "light" | "dark" }) {
  const help = useUi(s => s.setHelpOpen);
  const navigationRules = useUi(s => s.openNavigationRules);
  const paused = useUi(s => s.ambientMotionPaused);
  const backToArena = () => {
    const arena = document.getElementById("arena");
    arena?.scrollIntoView({ behavior: "instant", block: "start" });
    arena?.focus({ preventScroll: true });
  };
  return <footer id="footer" className="app-footer" data-theme={theme} data-layout={arenaHref ? "landing" : "arena"} aria-label="About FLINCH">
    <div className="footer-content">
      <div className="footer-toolbar">
        <nav className="footer-links" aria-label="Protocol documentation">
          {protocolLinks.map(link => <a key={link.title} className="footer-icon" href={link.href} target="_blank" rel="noreferrer" aria-label={link.title} title={`${link.title} documentation`}><EcosystemIcon name={link.icon} /></a>)}
        </nav>
      </div>
      <div className="footer-scene">
        <FooterHands paused={paused} />
        <div className="footer-identity">
          <h2 className="footer-lockup"><BrandLogo /><span className="footer-times">×</span><span>MagicBlock</span></h2>
          <p className="footer-tagline">Built for MagicBlock Blitz V8</p>
        </div>
      </div>
      <div className="footer-meta">
        <details className="footer-notice">
          <summary>{config.network === "devnet" ? "Solana Devnet" : "Localnet"} / Network details</summary>
          <div><p>{config.transactions ? "Experimental build. Test tokens only." : "Read-only preview. Transactions are disabled."}</p>
            <p>{config.network === "devnet" ? "Devnet SOL and USDC have no monetary value. Never send mainnet assets." : "This is a separate local sandbox, not public Devnet. Local tokens have no monetary value."}</p>
            <p>No real-money wagering. Network fees and account rent apply. Reference prices are not sell quotes.</p></div>
        </details>
        <button className="footer-rules" type="button" onClick={() => arenaHref ? help(true) : navigationRules()}>Read the rules<ArrowUpRight size={14} aria-hidden /></button>
        {arenaHref ? <a className="footer-return" href={arenaHref} style={{ textDecoration: "none" }}>Enter the arena<ArrowUpRight size={14} aria-hidden /></a>
          : <button className="footer-return" type="button" onClick={backToArena} aria-label="Back to arena">Back to arena<ArrowUp size={14} aria-hidden /></button>}
      </div>
    </div>
  </footer>;
}
