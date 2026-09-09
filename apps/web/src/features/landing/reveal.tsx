"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

export function RevealSequence({ children, className }: { children: ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = root.current;
    if (!container || !window.IntersectionObserver || !Element.prototype.animate) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pending = new Set<HTMLElement>();
    const animations = new Set<Animation>();
    const finish = (element: HTMLElement) => {
      pending.delete(element);
      element.style.removeProperty("opacity");
      element.dataset.revealed = "true";
    };
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const element = entry.target as HTMLElement;
        observer.unobserve(element);
        finish(element);
        if (preference.matches) continue;
        const words = element.querySelectorAll<HTMLElement>("[data-word]");
        const targets = words.length ? [...words] : [element];
        targets.forEach((target, index) => {
          const animation = target.animate([
            { opacity: 0, filter: words.length ? "blur(5px)" : "blur(3px)", transform: "translateY(8px)" },
            { opacity: 1, filter: "blur(0px)", transform: "translateY(0px)" },
          ], { duration: 440, delay: Math.min(index * 38, 228) + Number(element.dataset.delay || 0), easing: "cubic-bezier(.22,1,.36,1)", fill: "backwards" });
          animations.add(animation);
          animation.onfinish = () => animations.delete(animation);
        });
      }
    }, { threshold: 0, rootMargin: "0px 0px -32px 0px" });
    const showAll = () => {
      if (!preference.matches) return;
      observer.disconnect();
      pending.forEach(finish);
      animations.forEach(animation => animation.cancel());
      animations.clear();
    };
    if (!preference.matches) {
      container.querySelectorAll<HTMLElement>("[data-reveal]").forEach(element => {
        if (element.getBoundingClientRect().top >= innerHeight && !element.querySelector("a, button, summary")) {
          element.style.opacity = "0";
          pending.add(element);
        }
        observer.observe(element);
      });
    }
    const focus = (event: FocusEvent) => {
      const element = (event.target as HTMLElement).closest<HTMLElement>("[data-reveal]");
      if (element) { observer.unobserve(element); finish(element); }
      animations.forEach(animation => animation.finish());
    };
    container.addEventListener("focusin", focus);
    preference.addEventListener("change", showAll);
    return () => {
      observer.disconnect();
      pending.forEach(finish);
      animations.forEach(animation => animation.cancel());
      container.removeEventListener("focusin", focus);
      preference.removeEventListener("change", showAll);
    };
  }, []);
  return <div ref={root} className={className}>{children}</div>;
}
