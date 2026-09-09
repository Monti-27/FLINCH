"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useStore } from "zustand";
import { createUiStore } from "../stores/ui-store.ts";
import type { UiState } from "../stores/ui-store.ts";

const UiContext = createContext<ReturnType<typeof createUiStore> | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createUiStore);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const viewport = window.matchMedia("(max-width: 1100px)");
    const sync = () => store.getState().setReducedMotion(preference.matches);
    const resize = () => store.getState().setCompactPlayers(viewport.matches);
    sync();
    resize();
    preference.addEventListener("change", sync);
    viewport.addEventListener("change", resize);
    return () => { preference.removeEventListener("change", sync); viewport.removeEventListener("change", resize); };
  }, [store]);
  return <UiContext.Provider value={store}>{children}</UiContext.Provider>;
}

export function useUi<T>(selector: (state: UiState) => T): T {
  const store = useContext(UiContext);
  if (!store) throw new Error("UI state requires UiProvider");
  return useStore(store, selector);
}
