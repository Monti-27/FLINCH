"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useStore } from "zustand";
import { ChartLine, Maximize2, Minimize2, RotateCcw, ChartNoAxesColumn } from "lucide-react";
import { useUi } from "../../providers/ui-provider.tsx";
import { createMarketStore } from "./store.ts";
import type { MarketStore } from "./store.ts";
import { connectMarket } from "./stream.ts";
import { SegmentedControl } from "../../components/ui/segmented-control.tsx";
import { EcosystemIcon } from "../../components/brand/ecosystem-icon.tsx";
import { useChartFullscreen } from "./use-chart-fullscreen.ts";
import AnimatedNumberCounter from "../../components/ui/count-down-numbers.tsx";
import { CHART_INTERVALS } from "./chart-options.ts";
import { ChartStyleSelect } from "./chart-style-select.tsx";
import { ChartSkeleton, MarketPriceSkeleton } from "./market-skeleton.tsx";

const MarketChart = dynamic(() => import("./market-chart.tsx").then(module => module.MarketChart), {
  ssr: false,
  loading: () => null,
});

export function MarketPanel() {
  const [store] = useState(createMarketStore);
  const [reset, setReset] = useState(0);
  const [volume, setVolume] = useState(false);
  const [connection, setConnection] = useState(0);
  const [renderer, setRenderer] = useState<"loading" | "ready" | "error">("loading");
  const fullscreen = useChartFullscreen();
  const interval = useUi(s => s.interval);
  const setInterval = useUi(s => s.setInterval);
  const style = useUi(s => s.chartStyle);
  const setStyle = useUi(s => s.setChartStyle);
  useEffect(() => connectMarket(store), [store, connection]);
  return <section ref={fullscreen.panel} className="market-panel" aria-label="Reference market">
    <div className="market-topline">
      <MarketHeading store={store} />
      <FeedStatus store={store} />
    </div>
      <div className="chart-toolbar">
        <SegmentedControl label="Candle interval" value={interval} onChange={setInterval}
          options={CHART_INTERVALS.map(value => ({ value, label: `${value / 60}m` }))} />
        <ChartStyleSelect value={style} onChange={setStyle} />
        <div className="chart-utilities">
          <button type="button" className="icon-button" aria-label="Reset chart view" title="Reset chart view" onClick={() => setReset(value => value + 1)}><RotateCcw size={15} aria-hidden /></button>
          <button type="button" ref={fullscreen.trigger} className="icon-button" aria-label={fullscreen.active ? "Exit fullscreen chart" : "Fullscreen chart"}
            title={fullscreen.active ? "Exit fullscreen" : "Fullscreen"} disabled={!fullscreen.available} onClick={() => void fullscreen.toggle()}>
            {fullscreen.active ? <Minimize2 size={15} aria-hidden /> : <Maximize2 size={15} aria-hidden />}
          </button>
        </div>
      </div>
    <div className="chart-frame"><MarketChart store={store} interval={interval} style={style} reset={reset} volume={volume} onState={setRenderer} /><ChartEmpty store={store} renderer={renderer} retry={() => setConnection(value => value + 1)} /></div>
    {fullscreen.error && <p className="chart-error" role="status">{fullscreen.error}</p>}
    <div className="chart-footnote">
      <button type="button" className="chart-volume" aria-label="Show volume" aria-pressed={volume} onClick={() => setVolume(value => !value)}><ChartNoAxesColumn size={15} aria-hidden /><span>Volume</span></button>
      <span className="chart-reference-note">Reference only · not your sell price</span>
      <span className="chart-timezone">UTC</span>
      <details className="chart-disclosure" onKeyDown={event => {
        if (event.key !== "Escape") return;
        event.currentTarget.open = false;
        event.currentTarget.querySelector("summary")?.focus();
      }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }}><summary>About this chart</summary><div><p>Real SOL/USD trades from Coinbase Exchange, not Solana onchain data, a MagicBlock oracle or an executable Raydium quote. Times are UTC. Drag to pan and scroll to zoom.</p>
        <p>1m candles use Coinbase history and live trades. 2m and 5m combine those observations. Line and Mountain show closing prices. No simulated prices or interpolated candles.</p>
        <p>Historical volume comes from Coinbase. Live volume counts received trade sizes only, restarting at connection; candles and volume may be incomplete. Missing observations are not filled.</p>
        <a href="https://klinecharts.com/en-US/" target="_blank" rel="noreferrer">KLineCharts</a><a href="/licenses/klinecharts.txt" target="_blank" rel="noreferrer">License and notices</a></div></details>
    </div>
  </section>;
}

function MarketHeading({ store }: { store: MarketStore }) {
  const tick = useStore(store, s => s.tick);
  const first = useStore(store, s => s.candles[0]?.open);
  const last = useStore(store, s => s.candles.at(-1)?.close);
  const status = useStore(store, s => s.status);
  const price = tick?.price ?? last;
  const change = price && first ? (price / first - 1) * 100 : undefined;
  const direction = change === undefined ? "flat" : change > 0 ? "up" : change < 0 ? "down" : "flat";
  return <div className="market-heading">
    <div className="market-pair"><EcosystemIcon name="solana" /><h2>SOL <span>/ USD</span></h2><span className="caption">Coinbase spot</span></div>
    {price === undefined && status === "connecting" ? <MarketPriceSkeleton /> : <div className="market-price"><strong><AnimatedNumberCounter value={price?.toFixed(2)} prefix="$" /></strong>
      <span className="price-change" data-direction={direction}>{change === undefined ? "No price available" : <AnimatedNumberCounter value={change.toFixed(2)} prefix={Number(change.toFixed(2)) > 0 ? "+" : ""} suffix="%" flashOnChange={false} />} <small>{change !== undefined && "loaded window"}</small></span></div>}
  </div>;
}

function FeedStatus({ store }: { store: MarketStore }) {
  const status = useStore(store, s => s.status);
  return <span className={`feed-status ${status}`} role="status">{status === "live" ? "Live reference" : status === "connecting" ? "Connecting" : status === "stale" ? "Stale reference" : "Feed offline"}</span>;
}

export function ChartEmpty({ store, renderer, retry }: { store: MarketStore; renderer: "loading" | "ready" | "error"; retry: () => void }) {
  const empty = useStore(store, s => s.candles.length === 0);
  const status = useStore(store, s => s.status);
  const error = useStore(store, s => s.error);
  if (renderer === "error") return null;
  if ((empty && status === "connecting") || (!empty && renderer === "loading")) return <ChartSkeleton label={empty ? "Loading SOL/USD price history" : "Starting reference chart"} />;
  if (!empty) return error ? <p className="chart-warning" role="status">{error} Historical prices remain visible.</p> : null;
  return <div className="chart-empty" role="status"><ChartLine size={28} aria-hidden /><strong>Reference feed unavailable</strong>
    <p>{error ?? "Loading SOL/USD from Coinbase."}</p><span>Funding and claims remain available.</span>
    {status !== "connecting" && <button type="button" className="text-button" onClick={retry}>Retry feed</button>}</div>;
}
