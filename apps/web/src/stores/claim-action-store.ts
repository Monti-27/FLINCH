import { createStore } from "zustand/vanilla";
import type { ClaimAsset } from "../features/claims/withdrawal-state.ts";

type ClaimAction = ClaimAsset | "recover";
type ClaimActionState = {
  action?: ClaimAction;
  execute: (action: ClaimAction, perform: () => Promise<unknown>, onError: (error: unknown) => void) => Promise<void>;
};

export function createClaimActionStore() {
  return createStore<ClaimActionState>()((set, get) => ({
    execute: async (action, perform, onError) => {
      if (get().action) return;
      set({ action });
      try { await perform(); }
      catch (value) { onError(value); }
      finally { set({ action: undefined }); }
    },
  }));
}
