"use client";

import { useLayoutEffect, useRef } from "react";
import { animate, motion, useMotionValue } from "framer-motion";
import { NavigationContent } from "./navigation-content.tsx";
import type { NavigationPanel } from "../../stores/ui-store.ts";

export const NAV_MOTION = {
  spring: { type: "spring" as const, stiffness: 420, damping: 38 },
  fade: { duration: 0.15 },
};

export function NavigationPanels({ panel, reduced }: { panel: NavigationPanel | null; reduced: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const height = useMotionValue(0);
  useLayoutEffect(() => {
    const element = panel ? ref.current?.querySelector<HTMLElement>(`#navigation-${panel}`) : null;
    let animation: ReturnType<typeof animate> | undefined;
    const resize = () => {
      animation?.stop();
      const next = element?.offsetHeight ?? 0;
      if (reduced) height.set(next);
      else animation = animate(height, next, NAV_MOTION.spring);
    };
    resize();
    const observer = new ResizeObserver(resize);
    if (element) observer.observe(element);
    return () => { observer.disconnect(); animation?.stop(); };
  }, [panel, reduced, height]);
  return <motion.div ref={ref} className="navigation-panels" style={{ height }}>
    {(["game", "protocol", "rules"] as const).map(id => <motion.div key={id} id={`navigation-${id}`}
      className="navigation-panel" data-open={panel === id} inert={panel !== id} aria-hidden={panel !== id}
      initial={false} animate={{ opacity: panel === id ? 1 : 0, y: panel === id || reduced ? 0 : 6 }}
      transition={reduced ? { duration: 0 } : NAV_MOTION.fade}>
      <NavigationContent panel={id} />
    </motion.div>)}
  </motion.div>;
}
