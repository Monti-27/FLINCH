import { afterEach, expect, it, vi } from "vitest";
import type { DataLoader, KLineData } from "klinecharts";
import { chartBars, connectChart } from "../src/features/market/chart-feed.ts";
import { createMarketStore } from "../src/features/market/store.ts";
import { chartInterval } from "../src/features/market/chart-options.ts";

const candle = (time = 300) => ({ time, open: 10, high: 12, low: 9, close: 11, volume: 2 });

function harness(span = 1) {
  const store = createMarketStore();
  store.getState().replaceHistory([candle()]);
  let loader: DataLoader;
  let frame: FrameRequestCallback | undefined;
  let history: KLineData[] = [];
  const push = vi.fn();
  const symbol = { ticker: "SOL/USD", pricePrecision: 2, volumePrecision: 2 };
  const period = { type: "minute" as const, span };
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frame = callback; return 1; });
  vi.stubGlobal("cancelAnimationFrame", () => { frame = undefined; });
  const resetData = vi.fn(() => {
    loader.unsubscribeBar?.({ symbol, period });
    loader.getBars({ type: "init", timestamp: null, symbol, period, callback: (bars, more) => {
      history = bars;
      expect(more).toBe(false);
      loader.subscribeBar?.({ symbol, period, callback: push });
    } });
  });
  const cleanup = connectChart({ resetData, setDataLoader: value => { loader = value; resetData(); } }, store);
  return { store, push, resetData, cleanup, history: () => history, loader: () => loader!,
    flush: () => { const callback = frame; frame = undefined; callback?.(0); }, frame: () => frame,
    changePeriod: (value: number) => { period.span = value; resetData(); }, symbol, period };
}

afterEach(() => vi.unstubAllGlobals());

it("maps sorted observations to millisecond KLine bars without fabricated gaps", () => {
  const store = createMarketStore();
  store.getState().replaceHistory([candle(), candle(480)]);
  expect(chartBars(store, 60).map(bar => bar.timestamp)).toEqual([300_000, 480_000]);
  expect(chartBars(store, 300)).toEqual([{ timestamp: 300_000, open: 10, high: 12, low: 9, close: 11, volume: 4 }]);
});

it("batches updates and preserves every bar across a frame boundary", () => {
  const h = harness();
  h.store.getState().accept({ time: 359_000, sequence: 1, price: 12, size: 3 });
  h.store.getState().accept({ time: 360_000, sequence: 2, price: 13, size: 4 });
  h.store.getState().accept({ time: 420_000, sequence: 3, price: 14, size: 5 });
  expect(h.push).not.toHaveBeenCalled();
  h.flush();
  expect(h.push.mock.calls.map(([bar]) => bar.timestamp)).toEqual([300_000, 360_000, 420_000]);
  expect(h.resetData).toHaveBeenCalledTimes(1);
  h.cleanup();
});

it("replaces reconnected history and clears an older header tick", () => {
  const h = harness();
  h.store.getState().accept({ time: 310_000, sequence: 1, price: 12 });
  h.flush();
  h.store.getState().replaceHistory([candle(600)]);
  h.flush();
  expect(h.resetData).toHaveBeenCalledTimes(2);
  expect(h.history()[0].timestamp).toBe(600_000);
  expect(h.store.getState().tick).toBeUndefined();
  h.cleanup();
});

it("reaggregates on period changes without keeping the old subscription", () => {
  const h = harness();
  h.changePeriod(5);
  h.store.getState().accept({ time: 361_000, sequence: 1, price: 13, size: 3 });
  h.flush();
  expect(h.push).toHaveBeenLastCalledWith({ timestamp: 300_000, open: 10, close: 13, high: 13, low: 9, volume: 5 });
  h.cleanup();
});

it("groups real observations into UTC two-minute buckets", () => {
  const h = harness(2);
  expect(h.history()[0].timestamp).toBe(240_000);
  h.store.getState().accept({ time: 360_000, sequence: 1, price: 13, size: 3 });
  h.store.getState().accept({ time: 420_000, sequence: 2, price: 15, size: 4 });
  h.flush();
  expect(h.push).toHaveBeenLastCalledWith({ timestamp: 360_000, open: 13, high: 15, low: 13, close: 15, volume: 7 });
  expect(chartInterval(2)).toBe(120);
  expect(() => chartInterval(3)).toThrow("Unsupported chart interval");
  h.cleanup();
});

it("does not redraw status-only changes and cancels pending work on disposal", () => {
  const h = harness();
  h.store.getState().setStatus("offline");
  expect(h.frame()).toBeUndefined();
  h.store.getState().accept({ time: 301_000, sequence: 1, price: 12 });
  h.cleanup();
  h.flush();
  expect(h.push).not.toHaveBeenCalled();
  h.store.getState().accept({ time: 302_000, sequence: 2, price: 13 });
  expect(h.frame()).toBeUndefined();
});

it("marks the bounded history as exhausted instead of inventing pagination", () => {
  const h = harness();
  const callback = vi.fn();
  h.loader().getBars({ type: "forward", timestamp: 300_000, symbol: h.symbol, period: h.period, callback });
  expect(callback).toHaveBeenCalledWith([], false);
  h.cleanup();
});

it("prunes the chart when the store's oldest candle rolls off", () => {
  const h = harness();
  h.store.setState({ candles: [candle(600)] });
  h.flush();
  expect(h.history()).toHaveLength(1);
  expect(h.history()[0].timestamp).toBe(600_000);
  h.cleanup();
});
