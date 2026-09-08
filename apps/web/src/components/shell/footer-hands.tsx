"use client";

import { useEffect, useRef } from "react";
import { animate } from "framer-motion";
import { createShaderSurface } from "../../lib/shader/shader-surface.ts";
import { createHandFlowRenderer, handFlowPalette } from "../../lib/shader/hand-flow.ts";

const TIMING = { entrance: 1.65, rightDelay: 0.12 };
const ENTRANCE = { type: "spring" as const, duration: TIMING.entrance, bounce: 0 };

export function FooterHands({ paused }: { paused: boolean }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const hands = [...element.querySelectorAll<HTMLElement>(".footer-hand")];
    const surfaces = [...element.querySelectorAll<HTMLCanvasElement>("canvas")].map((canvas, index) => createShaderSurface(canvas, {
      createRenderer: gl => createHandFlowRenderer(gl, handFlowPalette(element), index ? -1 : 1),
      frameInterval: 0,
      pixelRatio: 1,
    }));
    const entrances: ReturnType<typeof animate>[] = [];
    let entered = false;
    let visible = false;
    const startsOffscreen = element.getBoundingClientRect().top >= innerHeight;
    const isPaused = () => element.dataset.paused === "true";
    const offset = (index: number) => `translateX(${index ? "32%" : "-32%"})`;
    const restore = () => hands.forEach(hand => {
      hand.style.removeProperty("opacity");
      hand.style.removeProperty("transform");
    });
    if (!preference.matches && !isPaused() && startsOffscreen) {
      hands.forEach((hand, index) => {
        hand.style.opacity = "0";
        hand.style.transform = offset(index);
      });
    }
    const sync = () => {
      const running = visible && !document.hidden && !preference.matches && !isPaused();
      element.dataset.running = String(running);
      surfaces.forEach(surface => surface.setPaused(!running));
      entrances.forEach(animation => {
        if (preference.matches || isPaused()) animation.complete();
        else if (!running && animation.state === "running") animation.pause();
        else if (running && animation.state === "paused") animation.play();
      });
      if (preference.matches || isPaused()) restore();
    };
    const observer = new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting);
      if (visible && !entered) {
        entered = true;
        if (!preference.matches && !isPaused() && startsOffscreen) {
          hands.forEach((hand, index) => {
            entrances.push(animate(hand, { transform: [offset(index), "translateX(0%)"], opacity: [0, 1] }, {
              ...ENTRANCE, delay: index ? TIMING.rightDelay : 0,
            }));
          });
        }
      }
      sync();
    }, { threshold: 0.15 });
    const mutation = new MutationObserver(sync);
    mutation.observe(element, { attributes: true, attributeFilter: ["data-paused"] });
    observer.observe(element);
    document.addEventListener("visibilitychange", sync);
    preference.addEventListener("change", sync);
    return () => {
      observer.disconnect();
      mutation.disconnect();
      entrances.forEach(animation => animation.stop());
      surfaces.forEach(surface => surface.dispose());
      restore();
      document.removeEventListener("visibilitychange", sync);
      preference.removeEventListener("change", sync);
    };
  }, []);

  return <div ref={root} className="footer-hands" aria-hidden="true" data-paused={paused} data-running="false">
    {["left", "right"].map(side => <div key={side} className={`footer-hand footer-hand-${side}`}>
      <div className="footer-hand-surface"><span className="footer-hand-flow" /><canvas className="footer-hand-current" data-state="loading" /></div>
    </div>)}
  </div>;
}
