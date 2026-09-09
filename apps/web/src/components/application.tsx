"use client";

import { useEffect, useState } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { webClient, webConfig } from "../lib/config.ts";
import { Game } from "./game.tsx";
import { UiProvider } from "../providers/ui-provider.tsx";
import { NotificationToaster } from "./ui/notification-toaster.tsx";
import { BrandLogo } from "./brand/logo.tsx";
import { notifyWalletError } from "../lib/notify-action.ts";
import { ArenaSkeleton } from "./shell/arena-skeleton.tsx";

export function Application() {
  const [runtime, setRuntime] = useState<ReturnType<typeof setup>>();
  const [error, setError] = useState("");
  useEffect(() => { try { setRuntime(setup()); } catch (value) { setError(value instanceof Error ? value.message : "Configuration unavailable"); } }, []);
  if (error) return <main><section className="panel brand-message" role="alert"><BrandLogo className="brand-status" /><h1>Configuration needs attention.</h1><p>{error}</p><p>No transaction has been submitted.</p></section></main>;
  if (!runtime) return <ArenaSkeleton />;
  return <ConnectionProvider endpoint={runtime.config.baseUrl}><WalletProvider wallets={[]} autoConnect onError={notifyWalletError}>
    <WalletModalProvider><UiProvider><Game client={runtime.client} config={runtime.config} />
      <NotificationToaster /></UiProvider></WalletModalProvider>
  </WalletProvider></ConnectionProvider>;
}

function setup() { const config = webConfig(); return { config, client: webClient(config) }; }
