"use client";

import { useEffect, useRef } from "react";
import { ChevronDown, X } from "lucide-react";
import { useUi } from "../../providers/ui-provider.tsx";
import { NavigationContent } from "./navigation-content.tsx";

export function Navigation({ home, inRoom }: { home: () => void; inRoom: boolean }) {
  const panel = useUi(s => s.navigationPanel);
  const mobileOpen = useUi(s => s.mobileNavigation);
  const compact = useUi(s => s.compactPlayers);
  const setPanel = useUi(s => s.setNavigationPanel);
  const close = useUi(s => s.closeNavigation);
  const help = useUi(s => s.setHelpOpen);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const visible = !compact || mobileOpen;
  useEffect(() => {
    if (!panel && !mobileOpen) return;
    const pointer = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node) && !(event.target as Element).closest?.(".navigation-toggle")) close();
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (compact) document.querySelector<HTMLButtonElement>(".navigation-toggle")?.focus();
      else trigger.current?.focus();
      close();
    };
    document.addEventListener("pointerdown", pointer);
    document.addEventListener("keydown", keyboard);
    return () => { document.removeEventListener("pointerdown", pointer); document.removeEventListener("keydown", keyboard); };
  }, [panel, mobileOpen, compact, close]);
  const dismiss = () => {
    if (compact) document.querySelector<HTMLButtonElement>(".navigation-toggle")?.focus();
    else trigger.current?.focus();
    close();
  };
  return <div ref={container} id="site-navigation" className="notched-navigation" data-mobile-open={mobileOpen}
    inert={!visible} aria-hidden={!visible}
    onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) close(); }}>
    <nav aria-label="Main navigation" className="navigation-bar">
      <button type="button" className="navigation-link" aria-current={!inRoom ? "page" : undefined} onClick={() => { close(); home(); }}>Arena</button>
      {(["game", "protocol"] as const).map(id => <button type="button" key={id} className="navigation-link"
        aria-expanded={panel === id} aria-controls={`navigation-${id}`} onClick={event => { trigger.current = event.currentTarget; setPanel(panel === id ? null : id); }}>
        {id === "game" ? "The game" : "Protocol"}<ChevronDown size={14} aria-hidden />
      </button>)}
      <button type="button" className="navigation-link navigation-help" aria-label="How to play" onClick={() => { setPanel(null); help(true); }}>How to play</button>
      <button type="button" className="icon-button navigation-close" aria-label="Close navigation" onClick={dismiss}><X size={18} aria-hidden /></button>
    </nav>
    {(["game", "protocol"] as const).map(id => <div key={id} id={`navigation-${id}`} className="navigation-panel"
      data-open={panel === id} inert={panel !== id} aria-hidden={panel !== id}>
      <NavigationContent panel={id} />
    </div>)}
  </div>;
}
