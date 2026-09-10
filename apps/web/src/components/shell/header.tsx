"use client";

import { Menu, X } from "lucide-react";
import { useUi } from "../../providers/ui-provider.tsx";
import type { WebConfig } from "../../lib/config.ts";
import { Navigation } from "./navigation.tsx";
import { WalletControl } from "./wallet-control.tsx";
import { BrandLogo } from "../brand/logo.tsx";

export function Header({ config, home, inRoom }: { config: WebConfig; home: () => void; inRoom: boolean }) {
  const mobileOpen = useUi(state => state.mobileNavigation);
  const setMobileOpen = useUi(state => state.setMobileNavigation);
  return (
    <header className="app-header">
      <div className="header-brand"><a href="/" className="header-logo" aria-label="FLINCH home"><BrandLogo /></a>
        <span className="mobile-network">{config.network === "devnet" ? "Devnet" : "Localnet"}</span>
      </div>
      <Navigation home={home} inRoom={inRoom} />
      <div className="header-actions">
        <span className="network">{config.network === "devnet" ? "Devnet" : "Localnet"}</span>
        <WalletControl />
        <button type="button" className="icon-button navigation-toggle" aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-controls="site-navigation" aria-expanded={mobileOpen} onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
        </button>
      </div>
    </header>
  );
}
