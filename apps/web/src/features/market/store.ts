import { createStore } from "zustand/vanilla";
import { appendTick, STALE_MS } from "./model.ts";
import type { Candle, Tick } from "./model.ts";

export type MarketState = {
  candles: Candle[];
  tick?: Tick;
  status: "connecting" | "live" | "stale" | "offline";
  error?: string;
  revision: number;
  replaceHistory: (candles: Candle[]) => void;
  accept: (tick: Tick) => void;
  setStatus: (status: MarketState["status"], error?: string) => void;
  checkFreshness: (now: number) => void;
};

export function createMarketStore() {
  return createStore<MarketState>()((set, get) => ({
    candles: [], status: "connecting", revision: 0,
    replaceHistory: candles => set(state => ({ candles, tick: undefined, revision: state.revision + 1 })),
    accept: tick => {
      const previous = get().tick;
      if (previous && (tick.sequence <= previous.sequence || tick.time < previous.time)) return;
      set(state => ({ tick, candles: appendTick(state.candles, tick), status: "live", error: undefined }));
    },
    setStatus: (status, error) => set({ status, error }),
    checkFreshness: now => {
      const state = get();
      if (state.status === "live" && (!state.tick || now - state.tick.time > STALE_MS)) set({ status: "stale", error: "Waiting for a fresh market trade" });
    },
  }));
}

export type MarketStore = ReturnType<typeof createMarketStore>;
