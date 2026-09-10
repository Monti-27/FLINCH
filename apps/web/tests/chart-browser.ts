import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";
import { checkChartControls } from "./chart-controls-browser.ts";
import { checkChartLayout } from "./chart-layout-browser.ts";
import { parseHistory, parseTick } from "../src/features/market/model.ts";
import type { Tick } from "../src/features/market/model.ts";

const url = process.env.FLINCH_UI_URL ?? "http://127.0.0.1:3410/play";
assert.equal(new URL(url).hostname, "127.0.0.1");
const directory = resolve(`artifacts/runs/chart-dark-${Date.now()}`);
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.FLINCH_BROWSER_EXECUTABLE });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultTimeout(20_000);
const errors: string[] = [];
const observed: Tick[] = [];
const sources = new Set<string>();
page.on("pageerror", error => errors.push(error.message));
page.on("websocket", socket => {
  sources.add(socket.url());
  socket.on("framereceived", ({ payload }) => {
    try {
      const tick = parseTick(JSON.parse(String(payload)));
      if (tick && observed.length < 20) observed.push(tick);
    } catch { return; }
  });
});

try {
  await page.goto(url);
  await expect(page.getByText("Live reference", { exact: true })).toBeVisible({ timeout: 20_000 });
  const local = await page.request.get(new URL("/api/market", url).href);
  const upstream = await fetch("https://api.exchange.coinbase.com/products/SOL-USD/candles?granularity=60", { signal: AbortSignal.timeout(10_000) });
  assert(local.ok() && upstream.ok);
  const history = parseHistory(await local.json());
  const origin = parseHistory(await upstream.json());
  const closed = history.filter(bar => bar.time < Math.floor(Date.now() / 60_000) * 60 - 60);
  let matches = 0;
  for (const bar of closed) {
    const source = origin.find(row => row.time === bar.time);
    if (source) { assert.deepEqual(bar, source); matches++; }
  }
  assert(matches > 200, "History must match the real upstream closed candles");
  const controls = await checkChartControls(page);
  const layout = await checkChartLayout(page, directory);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const chart = page.locator(".market-panel");
  await chart.scrollIntoViewIfNeeded();
  await expect(page.locator(".chart-frame")).toHaveCSS("background-color", "rgb(12, 12, 12)");
  const frames = [];
  for (const style of ["candles", "hollow", "bars", "line", "mountain"]) {
    await page.getByRole("combobox", { name: "Chart style" }).selectOption(style);
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await chart.screenshot({ path: resolve(directory, `${style}.png`) });
    frames.push(style);
  }
  await page.getByRole("combobox", { name: "Chart style" }).selectOption("candles");
  await page.getByRole("button", { name: "2m", exact: true }).click();
  await chart.screenshot({ path: resolve(directory, "two-minute.png") });
  await page.getByRole("button", { name: "Show volume", exact: true }).click();
  await chart.screenshot({ path: resolve(directory, "volume.png") });
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(await page.locator(".chart-style-select select").evaluate(element => getComputedStyle(element).transitionDuration), "0s");
  await page.context().setOffline(true);
  await expect(page.getByText("Feed offline", { exact: true })).toBeVisible();
  await page.context().setOffline(false);
  await expect(page.getByText("Live reference", { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => observed.length).toBeGreaterThan(1);
  assert(sources.has("wss://ws-feed.exchange.coinbase.com/" ) || sources.has("wss://ws-feed.exchange.coinbase.com"));
  await page.route("**/api/market", route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Test outage" }) }));
  await page.reload();
  await expect(page.getByText("Reference feed unavailable", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry feed", exact: true })).toBeEnabled();
  await expect(page.locator(".market-price strong")).not.toContainText("$0");
  await page.unroute("**/api/market");
  await page.getByRole("button", { name: "Retry feed", exact: true }).click();
  await expect(page.getByText("Live reference", { exact: true })).toBeVisible({ timeout: 20_000 });
  assert.deepEqual(errors, []);
  writeFileSync(resolve(directory, "result.json"), JSON.stringify({ complete: true, controls, layout, frames,
    source: "Coinbase Exchange SOL-USD, offchain reference, not a Solana oracle or Raydium quote",
    matchedClosedCandles: matches, upstreamSample: origin.slice(-3), websocketSources: [...sources], observed,
    reducedMotion: true, offlineRecovery: true, explicitOutageAndRetry: true, pageErrors: errors }, null, 2));
  console.log(`Chart browser checks passed: ${directory}`);
} catch (error) {
  await page.screenshot({ path: resolve(directory, "failure.png"), fullPage: true });
  console.error(`Chart evidence: ${directory}`);
  console.error(errors);
  throw error;
} finally { await browser.close(); }
