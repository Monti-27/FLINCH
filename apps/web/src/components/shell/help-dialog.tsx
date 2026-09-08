"use client";

import { useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Button } from "../ui/button.tsx";
import { useUi } from "../../providers/ui-provider.tsx";

export function HelpDialog() {
  const open = useUi(s => s.helpOpen);
  const setOpen = useUi(s => s.setHelpOpen);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && !ref.current?.open) ref.current?.showModal();
    if (!open && ref.current?.open) ref.current.close();
  }, [open]);
  const containFocus = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== "Tab") return;
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea, [tabindex]")]
      .filter(element => element.tabIndex >= 0 && !element.matches(":disabled") && element.getClientRects().length > 0);
    const first = controls[0];
    const last = controls.at(-1);
    const target = event.shiftKey && document.activeElement === first ? last : !event.shiftKey && document.activeElement === last ? first : undefined;
    if (target) { event.preventDefault(); target.focus(); }
  };
  return <dialog ref={ref} className="help-dialog" aria-labelledby="help-title" onKeyDown={containFocus} onCancel={() => setOpen(false)} onClose={() => setOpen(false)}>
    <div className="dialog-heading"><h2 id="help-title">How to play</h2><button className="icon-button" aria-label="Close rules" onClick={() => setOpen(false)}><X size={20} aria-hidden /></button></div>
    <ol className="rules-list"><li><strong>Four players. Equal stakes.</strong><p>Join with 0.001–0.01 test SOL, wrapped to WSOL. The round starts when all four seats are funded.</p></li>
      <li><strong>90 seconds to hold or sell.</strong><p>Holding is automatic. A successful sale exchanges your WSOL for test USDC through Raydium.</p></li>
      <li><strong>Sell first. Pay the holders.</strong><p>Up to 0.25% of your current WSOL goes to holders outside your two-second sell batch. If everyone sells together, the penalty is zero.</p></li>
      <li><strong>Your assets stay yours.</strong><p>The last holder keeps WSOL. Multiple holders at timeout keep their entitlements. A queued SELL is not a completed swap; failed fills charge no game penalty.</p></li></ol>
    <p className="notice">Experimental test-token build. Reference prices are not executable quotes. Network fees and account rent are separate.</p>
    <Button onClick={() => setOpen(false)}>Got it</Button>
  </dialog>;
}
