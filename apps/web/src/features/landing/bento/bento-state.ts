import { createStore } from "zustand/vanilla";

export const sceneNames = ["custody", "rollup", "decision", "holders", "settlement"] as const;
export type SceneName = typeof sceneNames[number];
export const staticScenePhases: Record<SceneName, number> = { custody: 3, rollup: 2, decision: 0, holders: 2, settlement: 2 };
type SceneState = { phase: number; cycle: number };
type BentoState = {
  documentVisible: boolean;
  scenes: Record<SceneName, SceneState>;
  setDocumentVisible: (visible: boolean) => void;
  advance: (name: SceneName) => void;
};

export function createBentoStore() {
  return createStore<BentoState>()(set => ({
    documentVisible: false,
    scenes: Object.fromEntries(sceneNames.map(name => [name, { phase: 0, cycle: 0 }])) as Record<SceneName, SceneState>,
    setDocumentVisible: documentVisible => set({ documentVisible }),
    advance: name => set(state => {
      const scene = state.scenes[name];
      return { scenes: { ...state.scenes, [name]: {
        phase: (scene.phase + 1) % 4, cycle: scene.phase === 3 ? (scene.cycle + 1) % 1_000_000 : scene.cycle,
      } } };
    }),
  }));
}
