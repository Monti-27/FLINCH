"use client";

import { useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";
import { X } from "lucide-react";
import { animate } from "framer-motion";
import { Button } from "../ui/button.tsx";
import { useUi } from "../../providers/ui-provider.tsx";
import { HelpContent } from "./help-content.tsx";
import styles from "./help-dialog.module.css";

export function HelpDialog() {
  const open = useUi(s => s.helpOpen);
  const setOpen = useUi(s => s.setHelpOpen);
  const reduced = useUi(s => s.reducedMotion);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || (!open && !dialog.open)) return;
    const entering = open && !dialog.open;
    if (entering) { dialog.showModal(); dialog.scrollTop = 0; }
    let cancelled = false;
    const animation = animate(dialog, {
      opacity: entering && !reduced ? [0, 1] : open ? 1 : 0,
      y: reduced ? 0 : entering ? [12, 0] : open ? 0 : 8,
      scale: reduced ? 1 : entering ? [0.98, 1] : open ? 1 : 0.98,
      "--help-backdrop": open ? 1 : 0,
    }, reduced ? { duration: 0 } : { duration: open ? 0.25 : 0.15, ease: [0.16, 1, 0.3, 1] });
    void animation.then(() => { if (!cancelled && !open) dialog.close(); });
    return () => { cancelled = true; animation.stop(); };
  }, [open, reduced]);
  const containFocus = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== "Tab") return;
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea, summary, [tabindex]")]
      .filter(element => element.tabIndex >= 0 && !element.matches(":disabled") && element.getClientRects().length > 0);
    const first = controls[0];
    const last = controls.at(-1);
    const target = event.shiftKey && document.activeElement === first ? last : !event.shiftKey && document.activeElement === last ? first : undefined;
    if (target) { event.preventDefault(); target.focus(); }
  };
  return <dialog ref={ref} className={`help-dialog ${styles.dialog}`} aria-labelledby="help-title" aria-describedby="help-description" onKeyDown={containFocus}
    onCancel={event => { event.preventDefault(); setOpen(false); }} onClose={() => setOpen(false)}
    onClick={event => { if (event.target !== event.currentTarget) return; const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) setOpen(false); }}>
    <div className="dialog-heading"><div><span className="rules-eyebrow">The quick guide</span><h2 id="help-title">How to play</h2><p id="help-description">A game of nerve, in four steps.</p></div>
      <button type="button" className="icon-button" aria-label="Close rules" onClick={() => setOpen(false)}><X size={20} aria-hidden /></button></div>
    <HelpContent />
    <div className="rules-footer"><span>Ready when you are.</span><Button onClick={() => setOpen(false)}>Got it</Button></div>
  </dialog>;
}
