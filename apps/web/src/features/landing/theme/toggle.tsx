"use client";

import { Moon, Sun } from "lucide-react";
import { useLandingTheme } from "./provider.tsx";

export function LandingThemeToggle() {
  const { theme, ready, busy, toggle } = useLandingTheme();
  return <button type="button" role="switch" aria-label="Dark mode" aria-checked={theme === "dark"}
    aria-busy={busy} disabled={!ready} aria-disabled={busy || undefined} onClick={toggle}
    title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    className="relative inline-grid size-11 shrink-0 cursor-pointer place-items-center rounded-lg border-0! bg-transparent! p-0! text-(--ink-soft)! hover:bg-(--paper-inset)! hover:text-(--ink)! focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring) active:transform-none! disabled:cursor-default motion-safe:transition-colors motion-safe:duration-100 motion-reduce:transition-none">
    <Sun size={18} strokeWidth={1.7} aria-hidden className="absolute scale-100 rotate-0 opacity-100 group-data-[landing-theme=dark]/landing:scale-50 group-data-[landing-theme=dark]/landing:-rotate-90 group-data-[landing-theme=dark]/landing:opacity-0 motion-safe:transition-[transform,opacity] motion-safe:duration-200 motion-safe:ease-out" />
    <Moon size={18} strokeWidth={1.7} aria-hidden className="absolute scale-50 rotate-90 opacity-0 group-data-[landing-theme=dark]/landing:scale-100 group-data-[landing-theme=dark]/landing:rotate-0 group-data-[landing-theme=dark]/landing:opacity-100 motion-safe:transition-[transform,opacity] motion-safe:duration-200 motion-safe:ease-out" />
  </button>;
}
