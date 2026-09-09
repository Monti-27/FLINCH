import type { Chart, DataLoader, KLineData } from "klinecharts";
import { aggregate } from "./model.ts";
import type { MarketStore } from "./store.ts";
import { chartInterval } from "./chart-options.ts";
import type { ChartInterval } from "./chart-options.ts";

export function chartBars(store: MarketStore, interval: ChartInterval): KLineData[] {
  return aggregate(store.getState().candles, interval).map(({ time, open, high, low, close, volume }) => ({
    timestamp: time * 1000, open, high, low, close, volume,
  }));
}

export function connectChart(chart: Pick<Chart, "setDataLoader" | "resetData">, store: MarketStore, reset = () => chart.resetData()) {
  let frame = 0;
  let revision = -1;
  let first: number | undefined;
  let last = 0;
  let interval: ChartInterval = 60;
  let push: ((bar: KLineData) => void) | undefined;
  const loader: DataLoader = {
    getBars: ({ type, period, callback }) => {
      if (type !== "init") { callback([], false); return; }
      interval = chartInterval(period.span);
      const bars = chartBars(store, interval);
      revision = store.getState().revision;
      first = bars[0]?.timestamp;
      last = bars.at(-1)?.timestamp ?? 0;
      callback(bars, false);
    },
    subscribeBar: ({ callback }) => { push = callback; },
    unsubscribeBar: () => { push = undefined; },
  };
  const draw = () => {
    frame = 0;
    const bars = chartBars(store, interval);
    if (revision !== store.getState().revision || first !== bars[0]?.timestamp) {
      reset();
      return;
    }
    if (!push) return;
    for (const bar of bars) if (bar.timestamp >= last) push(bar);
    last = bars.at(-1)?.timestamp ?? 0;
  };
  chart.setDataLoader(loader);
  const unsubscribe = store.subscribe((state, previous) => {
    if (state.candles !== previous.candles && !frame) frame = requestAnimationFrame(draw);
  });
  return () => { unsubscribe(); cancelAnimationFrame(frame); push = undefined; };
}
