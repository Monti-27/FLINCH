"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useInView } from "framer-motion";
import type { Transition } from "framer-motion";
import { useStore } from "zustand";
import { useUi } from "../../../providers/ui-provider.tsx";
import { createBentoStore, staticScenePhases } from "./bento-state.ts";
import type { SceneName } from "./bento-state.ts";

export const TIMING = { stagger: 100, phases: [850, 950, 1150, 1100], detailStagger: 0.06 } as const;
const SPRING = { type: "spring", stiffness: 300, damping: 30, mass: 1 } as const;
const Context = createContext<ReturnType<typeof createBentoStore> | null>(null);
export type SceneMotion = { phase: number; transition: (index?: number) => Transition };

export function BentoMotionProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createBentoStore);
  useEffect(() => {
    const update = () => store.getState().setDocumentVisible(document.visibilityState === "visible");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, [store]);
  return <Context.Provider value={store}>{children}</Context.Provider>;
}

function useBentoEnvironment() {
  const store = useContext(Context);
  if (!store) throw new Error("Bento motion requires its provider");
  const documentVisible = useStore(store, state => state.documentVisible);
  const reduced = useUi(state => state.reducedMotion);
  const paused = useUi(state => state.ambientMotionPaused);
  return { store, documentVisible, reduced, paused };
}

export function useBentoScene(name: SceneName, index: number) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { amount: 0.25 });
  const { store, documentVisible, reduced, paused } = useBentoEnvironment();
  const scene = useStore(store, state => state.scenes[name]);
  const running = inView && documentVisible && !reduced && !paused;
  useEffect(() => {
    if (!running) return;
    const delay = TIMING.phases[scene.phase] + (scene.phase === 0 && scene.cycle === 0 ? index * TIMING.stagger : 0);
    const timer = setTimeout(() => store.getState().advance(name), delay);
    return () => clearTimeout(timer);
  }, [running, store, name, index, scene.phase, scene.cycle]);
  return { ref, running, cycle: scene.cycle, phase: reduced ? staticScenePhases[name] : scene.phase,
    transition: (index = 0): Transition => running ? { ...SPRING, delay: index * TIMING.detailStagger } : { duration: 0 },
  };
}
