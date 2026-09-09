"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { LayoutGroup, motion } from "framer-motion";
import { useUi } from "../../providers/ui-provider.tsx";
import { NavigationPanels, NAV_MOTION } from "./navigation-motion.tsx";

export function Navigation({ home, inRoom }: { home: () => void; inRoom: boolean }) {
  const panel = useUi(s => s.navigationPanel);
  const mobileOpen = useUi(s => s.mobileNavigation);
  const compact = useUi(s => s.compactPlayers);
  const reduced = useUi(s => s.reducedMotion);
  const setPanel = useUi(s => s.setNavigationPanel);
  const close = useUi(s => s.closeNavigation);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const visible = !compact || mobileOpen;
  const selected = panel ?? (!inRoom ? "arena" : null);
  useLayoutEffect(() => {
    if (panel !== "rules") return;
    const button = container.current?.querySelector<HTMLButtonElement>('[aria-controls="navigation-rules"]');
    if (!button) return;
    trigger.current = button;
    const frame = requestAnimationFrame(() => {
      const bounds = button.getBoundingClientRect();
      if (bounds.top < 0 || bounds.bottom > innerHeight) container.current?.closest("header")?.scrollIntoView({ behavior: "instant", block: "start" });
      if (document.activeElement !== button) button.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [panel]);
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
  return <div ref={container} id="site-navigation" className="notched-navigation" data-mobile-open={mobileOpen}
    inert={!visible} aria-hidden={!visible}
    onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) close(); }}>
    <motion.div className="navigation-surface" initial={false}
      animate={{ opacity: visible ? 1 : 0, y: visible || reduced ? 0 : -8, visibility: "visible", transitionEnd: { visibility: visible ? "visible" : "hidden" } }}
      transition={reduced ? { duration: 0 } : NAV_MOTION.spring}>
    <LayoutGroup><nav aria-label="Main navigation" className="navigation-bar">
      <button type="button" className="navigation-link" aria-current={!inRoom ? "page" : undefined} onClick={() => { close(); home(); }}>
        {selected === "arena" && <motion.span className="navigation-selection" layoutId="navigation-selection" transition={reduced ? { duration: 0 } : NAV_MOTION.spring} />}
        <span>Arena</span>
      </button>
      {(["game", "protocol", "rules"] as const).map(id => <button type="button" key={id} className="navigation-link"
        aria-label={id === "game" ? "The game" : id === "rules" ? "How to play" : "Protocol"}
        aria-expanded={panel === id} aria-controls={`navigation-${id}`} onClick={event => { trigger.current = event.currentTarget; setPanel(panel === id ? null : id); }}>
        {selected === id && <motion.span className="navigation-selection" layoutId="navigation-selection" transition={reduced ? { duration: 0 } : NAV_MOTION.spring} />}
        <span className="navigation-label-full">{id === "game" ? "The game" : id === "rules" ? "How to play" : "Protocol"}</span>
        <span className="navigation-label-short" aria-hidden>{id === "game" ? "Game" : id === "rules" ? "Rules" : "Protocol"}</span>
        <motion.span className="navigation-chevron" animate={{ rotate: panel === id ? 180 : 0 }} transition={reduced ? { duration: 0 } : NAV_MOTION.spring}><ChevronDown size={14} aria-hidden /></motion.span>
      </button>)}
    </nav></LayoutGroup>
    <NavigationPanels panel={visible ? panel : null} reduced={reduced} />
    </motion.div>
  </div>;
}
