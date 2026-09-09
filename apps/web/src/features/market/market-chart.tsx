"use client";

import { useEffect, useRef, useState } from "react";
import { dispose, init } from "klinecharts";
import type { Chart } from "klinecharts";
import { connectChart } from "./chart-feed.ts";
import { chartPresentation, chartTheme } from "./chart-theme.ts";
import type { MarketStore } from "./store.ts";
import type { ChartInterval, ChartStyle } from "./chart-options.ts";
import { refreshChart } from "./chart-viewport.ts";

function fitChart(chart: Chart, width: number) {
  const count = Math.min(65, chart.getDataList().length || 65);
  chart.setBarSpace(Math.max(5, Math.min(40, (width - 104) / count)));
  chart.setOffsetRightDistance(40);
  chart.scrollToRealTime(0);
}

export function MarketChart({ store, interval, style, reset, volume, onState }: {
  store: MarketStore; interval: ChartInterval; style: ChartStyle; reset: number; volume: boolean;
  onState: (state: "loading" | "ready" | "error") => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const instance = useRef<Chart | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const colors = getComputedStyle(element);
    let disconnect: (() => void) | undefined;
    let observer: ResizeObserver | undefined;
    let frame = 0;
    let readyFrame = 0;
    onState("loading");
    try {
      const chart = init(element, {
        locale: "en-US", timezone: "UTC", hotkey: { enabled: false },
        styles: chartTheme(name => colors.getPropertyValue(name).trim()),
        layout: { yAxis: { gap: { top: 0.18, bottom: 0.12 } } },
      });
      if (!chart) throw new Error("Chart initialization failed");
      instance.current = chart;
      chart.setSymbol({ ticker: "SOL/USD", pricePrecision: 2, volumePrecision: 2 });
      chart.setOffsetRightDistance(40);
      chart.setBarSpace(Math.max(5, Math.min(12, (element.clientWidth - 104) / 65)));
      disconnect = connectChart(chart, store, () => refreshChart(chart));
      observer = new ResizeObserver(() => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          chart.resize();
          if (chart.getDataList().length * chart.getBarSpace().bar < element.clientWidth - 104) fitChart(chart, element.clientWidth);
        });
      });
      observer.observe(element);
      readyFrame = requestAnimationFrame(() => { readyFrame = requestAnimationFrame(() => onState("ready")); });
    } catch {
      setError(true);
      onState("error");
    }
    return () => {
      observer?.disconnect();
      cancelAnimationFrame(frame);
      cancelAnimationFrame(readyFrame);
      disconnect?.();
      dispose(element);
      instance.current = null;
    };
  }, [store, retry, onState]);
  useEffect(() => { instance.current?.setPeriod({ type: "minute", span: interval / 60 }); }, [interval, retry]);
  useEffect(() => {
    if (!host.current) return;
    const colors = getComputedStyle(host.current);
    instance.current?.setStyles(chartPresentation(style, name => colors.getPropertyValue(name).trim()));
  }, [style, retry]);
  useEffect(() => {
    const chart = instance.current;
    if (!chart) return;
    if (volume) {
      chart.createIndicator({ name: "VOL", shortName: "VOL · SOL", paneId: "volume_pane", calcParams: [],
        calc: bars => bars.map(bar => ({ open: bar.open, close: bar.close, volume: bar.volume })) });
      chart.setPaneOptions({ id: "volume_pane", height: 80, minHeight: 60, dragEnabled: false });
    } else chart.removeIndicator({ name: "VOL" });
  }, [volume, retry]);
  useEffect(() => {
    const chart = instance.current;
    if (!chart || !host.current) return;
    fitChart(chart, host.current.clientWidth);
  }, [reset, interval, retry]);
  return <>
    <div className="market-canvas" ref={host} role="img" aria-label={`Coinbase SOL/USD ${interval / 60}-minute ${style} reference chart. Current price and feed status are above. Not an onchain price or a game payout.`} />
    {error && <div className="chart-empty" role="status"><strong>Chart could not start</strong><p>Your room controls are still available.</p>
      <button type="button" onClick={() => { setError(false); setRetry(value => value + 1); }}>Retry chart</button></div>}
  </>;
}
