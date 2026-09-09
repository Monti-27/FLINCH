"use client";

import { useEffect, useMemo, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
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
import { RoomSidebar } from "./shell/room-sidebar.tsx";
import { Standoff } from "../features/match/standoff.tsx";
import { RoomNavigation } from "./shell/room-navigation.tsx";

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
    {!online && <p className="notice" role="status">Offline. New transactions are paused. Submitted transactions may still complete.</p>}
    <main id="arena" tabIndex={-1}>
      {!address ? <ArenaWorkspace overview={<Standoff />} players={<RoomSidebar onOpenSeat={() => {
          setLobbyMode("create");
          requestAnimationFrame(() => roomEntry.current?.querySelector<HTMLInputElement>("input")?.focus());
        }} />}>
        <div ref={roomEntry} className="room-entry"><Lobby client={client} config={config} signer={signer} busy={actions.busy} open={open} run={actions.run} /></div>
      </ArenaWorkspace>
        : <><RoomNavigation key={`navigation:${address}:${identity ?? "spectator"}`} address={address} connected={!!identity} busy={actions.busy} onLobby={() => open("")} onCheck={() => actions.check(address)} />
          <Match key={`${address}:${identity ?? "spectator"}`} client={client} address={address} signer={signer} enabled={config.transactions && online} busy={actions.busy} operation={actions.operation} run={actions.run} /></>}
      <TransactionStatus busy={actions.busy} operation={actions.operation} network={config.network} />
    </main>
    <Footer config={config} />
    </div>
  </>;
}
