import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { UiProvider } from "../src/providers/ui-provider.tsx";
import { MarketPanel } from "../src/features/market/market-panel.tsx";
import { chartPresentation, chartTheme } from "../src/features/market/chart-theme.ts";
import { CHART_STYLES } from "../src/features/market/chart-options.ts";

const setup = vi.hoisted(() => ({ ssr: undefined as boolean | undefined, loading: false }));
vi.mock("next/dynamic", () => ({ default: (_load: unknown, options: { ssr: boolean; loading: unknown }) => {
  setup.ssr = options.ssr;
  setup.loading = typeof options.loading === "function";
  return () => <div data-chart="client-only" />;
} }));

it("isolates the browser-only renderer from server rendering", () => {
  expect(setup).toEqual({ ssr: false, loading: true });
  const html = renderToStaticMarkup(<UiProvider><MarketPanel /></UiProvider>);
  expect(html).toContain('data-chart="client-only"');
  expect(html).toContain("Loading SOL/USD price history");
  expect(html).toContain("Reference only · not your sell price");
  expect(html).not.toContain("$0.00");
});

it("provides distinct, named native controls and the correct source attribution", () => {
  const html = renderToStaticMarkup(<UiProvider><MarketPanel /></UiProvider>);
  for (const label of ["Candle interval", "Chart style", "Show volume", "Reset chart view", "Fullscreen chart"]) expect(html).toContain(`aria-label="${label}"`);
  expect(html).toContain('<option value="candles" selected="">Candles</option>');
  expect(html).toContain('aria-label="Show volume" aria-pressed="false"');
  expect(html).toContain('aria-pressed="false">2m</button>');
  expect(html).toContain('href="https://klinecharts.com/en-US/"');
  expect(html).toContain('href="/licenses/klinecharts.txt"');
  expect(html).toContain("candles and volume may be incomplete");
  expect(html).toContain("not Solana onchain data");
  for (const style of CHART_STYLES) expect(html).toContain(`value="${style.value}"`);
});

it("keeps observations unsmoothed and decorative price animation off", () => {
  const theme = chartTheme(name => name);
  expect(theme.candle?.area).toMatchObject({ smooth: false, point: { animation: false } });
  expect(theme.candle?.bar?.upColor).toBe("--chart-up");
  expect(theme.candle?.bar?.downColor).toBe("--chart-down");
  expect(theme.grid?.vertical?.show).toBe(false);
  expect(theme.candle?.area?.backgroundColor).toBe("transparent");
});

it("provides distinct native styles without tinting the line view", () => {
  const expected = ["candle_solid", "candle_up_stroke", "ohlc", "area", "area"];
  CHART_STYLES.forEach((style, index) => {
    const theme = chartPresentation(style.value, name => name);
    expect(theme.candle?.type).toBe(expected[index]);
    expect(theme.candle?.area?.backgroundColor).toBe(style.value === "mountain" ? "--chart-mountain" : "transparent");
  });
  expect(chartPresentation("line", name => name).candle?.priceMark?.last?.upColor).toBe("--chart-line");
  expect(chartPresentation("candles", name => name).candle?.priceMark?.last?.upColor).toBe("--chart-up");
});
