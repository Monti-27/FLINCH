"use client";

import { createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { landingThemeClasses } from "./classes.ts";
import { readTheme, resolveTheme, saveTheme, THEME_KEY, THEME_ROOT, themeBootstrap, type LandingTheme } from "./preference.ts";
import { startThemeSweep } from "./sweep.ts";

const ThemeContext = createContext({ theme: "light" as LandingTheme, ready: false, busy: false, toggle: () => {} });

export function LandingThemeProvider({ children, className }: { children: ReactNode; className: string }) {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const active = useRef<(() => void) | null>(null);
  const preference = useRef<LandingTheme | null>(null);
  const mounted = useRef(false);
  const inFlight = useRef(false);
  const [theme, setTheme] = useState<LandingTheme>("light");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useLayoutEffect(() => {
    mounted.current = true;
    const system = matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      active.current?.();
      setTheme(resolveTheme(preference.current, system.matches));
    };
    const systemChange = () => { if (!preference.current && !inFlight.current) sync(); };
    const storage = (event: StorageEvent) => {
      if (event.key !== THEME_KEY && event.key !== null) return;
      preference.current = readTheme();
      sync();
    };
    preference.current = readTheme();
    setTheme(resolveTheme(preference.current, system.matches));
    setReady(true);
    system.addEventListener("change", systemChange);
    window.addEventListener("storage", storage);
    return () => {
      mounted.current = false;
      active.current?.();
      system.removeEventListener("change", systemChange);
      window.removeEventListener("storage", storage);
    };
  }, []);

  const toggle = () => {
    if (!ready || inFlight.current || !canvas.current) return;
    const next = theme === "light" ? "dark" : "light";
    inFlight.current = true;
    setBusy(true);
    active.current = startThemeSweep(canvas.current, next, () => {
      preference.current = next;
      saveTheme(next);
      flushSync(() => setTheme(next));
    }, () => {
      active.current = null;
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    });
  };

  return <ThemeContext.Provider value={{ theme, ready, busy, toggle }}>
    <div ref={root} id={THEME_ROOT} data-landing-theme={theme} suppressHydrationWarning className={`${className} ${landingThemeClasses}`}>
      <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      {children}
    </div>
    <canvas ref={canvas} hidden aria-hidden="true" data-theme-sweep="" className="pointer-events-none fixed inset-0 z-[9999] h-dvh w-full" />
  </ThemeContext.Provider>;
}

export function useLandingTheme() { return useContext(ThemeContext); }
