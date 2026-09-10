import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { Skeleton, SkeletonGroup } from "../src/components/ui/skeleton.tsx";
import { ArenaSkeleton, ActionSkeleton, PlayersSkeleton } from "../src/components/shell/arena-skeleton.tsx";
import { ChartSkeleton, MarketPriceSkeleton } from "../src/features/market/market-skeleton.tsx";
import { ChartEmpty } from "../src/features/market/market-panel.tsx";
import { ReceiptSkeleton } from "../src/features/proof/receipt-skeleton.tsx";
import { createMarketStore } from "../src/features/market/store.ts";

it("keeps decorative shapes out of the accessibility tree and labels the loading region", () => {
  const html = renderToStaticMarkup(<SkeletonGroup label="Loading balances"><Skeleton width="100px" height="24px" round /></SkeletonGroup>);
  expect(html).toContain('role="status"');
  expect(html).toContain('aria-busy="true"');
  expect(html).toContain('aria-label="Loading balances"');
  expect(html).toContain('aria-hidden="true"');
  expect(html).toContain('data-round="true"');
  expect(html).toContain('width:100px;height:24px');
});

it("server-renders the full arena geometry without providers or financial actions", () => {
  const html = renderToStaticMarkup(<ArenaSkeleton />);
  expect(html).toContain('data-arena-loading=""');
  expect(html).toContain('class="app-header"');
  expect(html).toContain('class="lobby-workspace"');
  expect(html).toContain('class="market-panel"');
  expect(html).toContain('aria-label="FLINCH home"');
  expect(html).not.toContain("<button");
  expect(html).not.toContain("<input");
  expect(html).not.toContain("seats filled");
  expect(html).not.toContain('class="panel skeleton"');
  expect(html).toContain('<span class="sr-only" role="status">Loading FLINCH…</span>');
});

it("reserves all four seats and action geometry without inventing room state", () => {
  const seats = renderToStaticMarkup(<PlayersSkeleton />);
  expect(seats.match(/class="player-slot /g)).toHaveLength(4);
  expect(seats).not.toContain("Seat available");
  const action = renderToStaticMarkup(<ActionSkeleton room />);
  expect(action).toContain("Reading room and its Solana balances");
  expect(action).not.toContain("<button");
});

it("uses chart plot and axis placeholders without fabricated prices or candles", () => {
  const html = renderToStaticMarkup(<ChartSkeleton />);
  expect(html.match(/data-skeleton=""/g)).toHaveLength(12);
  expect(html).toContain("Loading SOL/USD price history");
  expect(html).not.toContain("<canvas");
  expect(renderToStaticMarkup(<MarketPriceSkeleton />)).not.toContain("$");
});

it("covers both history and renderer waits but releases the skeleton when ready", () => {
  const store = createMarketStore();
  const view = (renderer: "loading" | "ready" | "error") => renderToStaticMarkup(<ChartEmpty store={{ ...store, getInitialState: store.getState }} renderer={renderer} retry={() => {}} />);
  expect(view("ready")).toContain("Loading SOL/USD price history");
  store.getState().replaceHistory([{ time: 60, open: 100, high: 101, low: 99, close: 100 }]);
  expect(view("loading")).toContain("Starting reference chart");
  expect(view("ready")).toBe("");
  expect(view("error")).toBe("");
});

it("replaces an empty failed feed with recovery and preserves historical data on reconnect", () => {
  const store = createMarketStore();
  const view = () => renderToStaticMarkup(<ChartEmpty store={{ ...store, getInitialState: store.getState }} renderer="ready" retry={() => {}} />);
  store.getState().setStatus("offline", "Test outage");
  expect(view()).toContain("Retry feed");
  expect(view()).not.toContain("data-skeleton");
  store.getState().replaceHistory([{ time: 60, open: 100, high: 101, low: 99, close: 100 }]);
  expect(view()).toContain("Historical prices remain visible");
  store.getState().setStatus("connecting");
  expect(view()).toBe("");
});

it("matches receipt rows without implying a swap or withdrawal", () => {
  const html = renderToStaticMarkup(<ReceiptSkeleton />);
  expect(html).toContain("Reading confirmed receipts");
  expect(html).toContain("receipt-placeholder");
  expect(html).not.toContain("Swap confirmed");
  expect(html).not.toContain("USDC");
});
