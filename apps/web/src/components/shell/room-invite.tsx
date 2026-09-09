"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, Link2, X } from "lucide-react";
import { useStore } from "zustand";
import { createRoomInviteStore } from "../../stores/room-invite-store.ts";
import { roomAddress } from "../../lib/room-link.ts";
import { Button } from "../ui/button.tsx";
import styles from "./room-invite.module.css";

export function RoomInvite({ address }: { address: string }) {
  try { roomAddress(address); } catch { return null; }
  return <InviteControl key={address} address={address} />;
}

function InviteControl({ address }: { address: string }) {
  const [store] = useState(() => createRoomInviteStore(address));
  const { status, link, copy, reset } = useStore(store);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (status === "manual") { input.current?.focus(); input.current?.select(); }
    if (status === "copied") { const timer = setTimeout(reset, 2000); return () => clearTimeout(timer); }
  }, [status, reset]);
  useEffect(() => () => store.getState().reset(), [store]);
  const close = () => { reset(); trigger.current?.focus(); };
  return <div className={styles.root} onKeyDown={event => { if (event.key === "Escape" && status === "manual") { event.stopPropagation(); close(); } }}>
    <Button ref={trigger} size="sm" className={styles.trigger} aria-label="Invite players: copy invite link"
      aria-busy={status === "copying"} disabled={status === "copying"} data-copied={status === "copied"}
      aria-expanded={status === "manual"} aria-controls={status === "manual" ? id : undefined}
      onClick={() => void copy(window.location.href, value => navigator.clipboard.writeText(value))}>
      <span className={styles.icon} aria-hidden><Link2 size={16} /><Check size={16} /></span>
      <span className={styles.label} aria-hidden><span>Invite<span className={styles.detail}> players</span></span><span><span className={styles.detail}>Link </span>copied</span></span>
    </Button>
    <span className={styles.announcement} role="status">{status === "copied" ? "Invite link copied" : status === "manual" ? "Clipboard unavailable. Copy the selected link." : ""}</span>
    {status === "manual" && <div id={id} className={styles.manual}>
      <div className={styles.heading}><label htmlFor={`${id}-link`}>Room invite link</label><Button variant="ghost" size="icon" aria-label="Close invite link" onClick={close}><X size={16} aria-hidden /></Button></div>
      <input id={`${id}-link`} ref={input} readOnly value={link} autoComplete="off" spellCheck={false} onFocus={event => event.target.select()} aria-describedby={`${id}-help`} />
      <p id={`${id}-help`}>Copy this link manually. Opening it never stakes tokens.</p>
    </div>}
  </div>;
}
