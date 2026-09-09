"use client";

import { useRef, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "../ui/button.tsx";
import { notifyActionError } from "../../lib/notify-action.ts";
import { RoomInvite } from "./room-invite.tsx";
import styles from "./room-navigation.module.css";

export function RoomNavigation({ address, connected, busy, onLobby, onCheck }: {
  address: string; connected: boolean; busy: boolean; onLobby: () => void; onCheck: () => Promise<void>;
}) {
  const checkingRef = useRef(false);
  const [checking, setChecking] = useState(false);
  const check = async () => {
    if (!connected || busy || checkingRef.current) return;
    checkingRef.current = true;
    setChecking(true);
    try { await onCheck(); }
    catch (error) { notifyActionError(error, { action: "Check transaction" }); }
    finally { checkingRef.current = false; setChecking(false); }
  };
  const hint = !connected ? "Connect a wallet to check its transactions" : busy ? "Wait for the current request to finish" : "Check saved transaction status";
  return <nav className={`room-nav ${styles.root}`} aria-label="Room navigation">
    <Button variant="secondary" size="sm" className={styles.control} onClick={onLobby}><ArrowLeft size={16} aria-hidden />Lobby</Button>
    <div className={styles.actions}><RoomInvite address={address} />
    <Button variant="secondary" size="sm" className={`${styles.control} ${styles.check}`} aria-label="Check transaction" title={hint}
      disabled={!connected || busy || checking} aria-busy={checking} onClick={() => void check()}>
      <RefreshCw size={16} aria-hidden />
      <span className={styles.label}><span data-visible={!checking}>Check<span className={styles.detail}> transaction</span></span><span data-visible={checking}>Checking<span className={styles.detail}> status</span></span></span>
    </Button></div>
    <span className="sr-only" role="status">{checking ? "Checking saved transaction status" : ""}</span>
  </nav>;
}
