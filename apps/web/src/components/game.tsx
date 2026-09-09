"use client";

import { useEffect, useMemo, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "./ui/button.tsx";
import type { FlinchClient, TransactionSigner } from "@flinch/client";
import type { WebConfig } from "../lib/config.ts";
import { useActions } from "../lib/use-actions.ts";
import { useUi } from "../providers/ui-provider.tsx";
import { Lobby } from "../features/lobby/lobby.tsx";
import { Match } from "../features/match/match.tsx";
import { TransactionStatus } from "../features/proof/transaction-status.tsx";
import { ArenaWorkspace } from "./shell/arena-workspace.tsx";
import { Header } from "./shell/header.tsx";
import { Footer } from "./shell/footer.tsx";
import { HelpDialog } from "./shell/help-dialog.tsx";
import { RoomSidebar } from "./shell/room-sidebar.tsx";
import { Standoff } from "../features/match/standoff.tsx";
import { EcosystemIcon } from "./brand/ecosystem-icon.tsx";
import { RoomInvite } from "./shell/room-invite.tsx";

export function Game({ client, config }: { client: FlinchClient; config: WebConfig }) {
  const wallet = useWallet();
  const identity = wallet.publicKey?.toBase58();
  const activeWallet = useRef(identity);
  activeWallet.current = identity;
  const address = useUi(s => s.room);
  const setAddress = useUi(s => s.setRoom);
  const online = useUi(s => s.online);
  const setOnline = useUi(s => s.setOnline);
  const setLobbyMode = useUi(s => s.setLobbyMode);
  const roomEntry = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const history = () => setAddress(new URL(window.location.href).searchParams.get("room") ?? "");
    const connectivity = () => setOnline(navigator.onLine);
    history(); connectivity();
    window.addEventListener("popstate", history);
    window.addEventListener("online", connectivity);
    window.addEventListener("offline", connectivity);
    return () => { window.removeEventListener("popstate", history); window.removeEventListener("online", connectivity); window.removeEventListener("offline", connectivity); };
  }, [setAddress, setOnline]);
  const signer = useMemo<TransactionSigner | undefined>(() => wallet.publicKey && wallet.signTransaction ? {
    publicKey: wallet.publicKey, sign: async tx => {
      if (activeWallet.current !== identity) throw new Error("Wallet changed before signing");
      const signed = await wallet.signTransaction!(tx);
      if (activeWallet.current !== identity) throw new Error("Wallet changed during signing");
      return signed;
    },
  } : undefined, [wallet.publicKey, wallet.signTransaction, identity]);
  const actions = useActions(client, identity, config.transactions && online);
  const open = (room: string) => {
    const url = new URL(window.location.href);
    if (room) url.searchParams.set("room", room); else url.searchParams.delete("room");
    window.history.pushState(null, "", url);
    setAddress(room);
  };
  return <>
    <a className="skip-link" href="#arena">Skip to arena</a>
    <div className="app-frame">
    <Header config={config} home={() => open("")} inRoom={!!address} />
    <div className="safety-strip"><span>{config.transactions ? "Test tokens only. No real-money wagering." : "Devnet preview. Gameplay is not deployed yet."}</span><span className="ecosystem-credit"><span className="ecosystem-label">Built on <EcosystemIcon name="solana" size={16} /> Solana</span> · <span className="ecosystem-label">Powered by <EcosystemIcon name="magicblock" size={16} /> MagicBlock</span></span></div>
    {!online && <p className="notice" role="status">Offline. New transactions are paused. Submitted transactions may still complete.</p>}
    <main id="arena" tabIndex={-1}>
      {!address ? <ArenaWorkspace overview={<Standoff />} players={<RoomSidebar onOpenSeat={() => {
          setLobbyMode("create");
          requestAnimationFrame(() => roomEntry.current?.querySelector<HTMLInputElement>("input")?.focus());
        }} />}>
        <div ref={roomEntry} className="room-entry"><Lobby client={client} config={config} signer={signer} busy={actions.busy} open={open} run={actions.run} /></div>
      </ArenaWorkspace>
        : <><nav className="room-nav"><button className="quiet" onClick={() => open("")}><ArrowLeft size={16} aria-hidden />Lobby</button>
          <RoomInvite address={address} />
          <Button variant="ghost" size="sm" className="room-check" aria-label="Check transaction" title="Check transaction" disabled={!identity || actions.busy} onClick={() => void actions.check(address)}><RefreshCw size={15} aria-hidden /><span>Check transaction</span></Button></nav>
          <Match key={`${address}:${identity ?? "spectator"}`} client={client} address={address} signer={signer} enabled={config.transactions && online} busy={actions.busy} operation={actions.operation} run={actions.run} /></>}
      <TransactionStatus busy={actions.busy} operation={actions.operation} network={config.network} />
    </main>
    <Footer config={config} />
    </div>
    <HelpDialog />
  </>;
}
