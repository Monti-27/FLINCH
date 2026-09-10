import { ArrowDown, ArrowRight, ArrowUpRight } from "lucide-react";
import { BrandLogo } from "../../components/brand/logo.tsx";
import { EcosystemIcon } from "../../components/brand/ecosystem-icon.tsx";
import { HelpDialog } from "../../components/shell/help-dialog.tsx";
import { UiProvider } from "../../providers/ui-provider.tsx";
import { HeroStandoff } from "./hero-standoff.tsx";
import { LandingDetails } from "./landing-details.tsx";
import { RevealSequence } from "./reveal.tsx";
import { LandingThemeProvider } from "./theme/provider.tsx";
import { LandingThemeToggle } from "./theme/toggle.tsx";
import { LandingFooter } from "./theme/footer.tsx";
import { darkActionHover } from "./theme/classes.ts";
import styles from "./landing.module.css";
import hero from "./hero.module.css";

export function LandingPage() {
  const config = {
    network: process.env.NEXT_PUBLIC_FLINCH_NETWORK === "localnet" ? "localnet" as const : "devnet" as const,
    transactions: process.env.NEXT_PUBLIC_FLINCH_ENABLE_TRANSACTIONS === "true",
  };
  return <UiProvider>
    <LandingThemeProvider className={styles.landing}>
      <a className="skip-link" href="#story">Skip to the story</a>
      <div className={styles.frame}>
        <header className={styles.header}>
          <a href="/" aria-label="FLINCH home" className={styles.logo}><BrandLogo /></a>
          <nav aria-label="Landing navigation" className={styles.nav}>
            <a href="#onchain">How it works</a><a href="#questions">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <LandingThemeToggle />
            <a href="/play" className={`${styles.headerAction} ${darkActionHover}`}>Open app<ArrowUpRight size={14} aria-hidden /></a>
          </div>
        </header>
        <RevealSequence className={styles.content}>
          <main id="story" tabIndex={-1}>
            <section className={hero.hero} aria-labelledby="landing-title">
              <div className={hero.content}>
                <h1 id="landing-title">Four players.<br /><span>Who flinches first?</span></h1>
                <p className={hero.description}>Equal stakes. Ninety seconds.<br />Sell your WSOL. Pay the players who hold.</p>
                <div className={hero.actions}>
                  <a href="/play" className={`${hero.primary} ${darkActionHover}`}>Enter the arena<ArrowRight size={16} aria-hidden /></a>
                  <a href="#onchain" className={hero.secondary}>How to play<ArrowDown size={16} aria-hidden /></a>
                </div>
                <p className={hero.disclosure}>{config.network === "devnet" ? "Devnet" : "Localnet"} {config.transactions ? "build" : "preview"}<span aria-hidden> · </span>Test tokens only</p>
              </div>
              <HeroStandoff />
            </section>
            <div className={styles.protocolStrip} aria-label="Built with">
              <span>Built on good foundations.</span>
              <div><EcosystemIcon name="solana" size={20} /><strong>Solana</strong></div>
              <div><EcosystemIcon name="magicblock" size={20} /><strong>MagicBlock</strong></div>
              <div><EcosystemIcon name="raydium" size={20} /><strong>Raydium</strong></div>
            </div>
            <LandingDetails />
          </main>
          <LandingFooter config={config} />
        </RevealSequence>
      </div>
    </LandingThemeProvider>
    <HelpDialog />
  </UiProvider>;
}
