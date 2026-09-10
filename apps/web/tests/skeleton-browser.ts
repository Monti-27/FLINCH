import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

const url = process.env.FLINCH_UI_URL ?? "http://127.0.0.1:3520/play";
assert.equal(new URL(url).hostname, "127.0.0.1");
const directory = resolve(`artifacts/runs/skeleton-${Date.now()}`);
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.FLINCH_BROWSER_EXECUTABLE });
const errors: string[] = [];
const layouts: unknown[] = [];
const loadedSelector = ".market-panel:visible";

function deferred() {
  let release = () => {};
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}

async function geometry(page: Page) {
  return page.locator(loadedSelector).evaluate(element => {
    const bounds = element.getBoundingClientRect();
    const frame = element.querySelector(".chart-frame")!.getBoundingClientRect();
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, plotHeight: frame.height,
      overflow: document.documentElement.scrollWidth > innerWidth,
      parts: Object.fromEntries([".market-price", ".market-heading", ".market-topline", ".chart-toolbar", ".chart-footnote"].map(selector => {
        const node = element.querySelector(selector)!;
        const rect = node.getBoundingClientRect();
        return [selector, { width: rect.width, height: rect.height }];
      })) };
  });
}

try {
  const staticContext = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await staticContext.newPage();
  for (const width of [375, 768, 1280]) {
    await staticPage.setViewportSize({ width, height: 900 });
    await staticPage.goto(url);
    await expect(staticPage.locator("[data-arena-loading]:visible")).toHaveCount(1);
    assert.equal(await staticPage.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.equal(await staticPage.locator(".standoff:visible").evaluate(element => {
      const [identity, timer] = Array.from(element.children).filter(child => !child.classList.contains("sr-only"));
      const edge = timer.getBoundingClientRect().left;
      return [...identity.querySelectorAll("[data-skeleton]")].some(shape => shape.getBoundingClientRect().right > edge);
    }), false);
    await staticPage.screenshot({ path: resolve(directory, `arena-${width}.png`), fullPage: true });
  }
  await staticContext.close();

  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  page.on("pageerror", error => errors.push(error.message));
  const history = await page.request.get(new URL("/api/market", url).href);
  assert.equal(history.status(), 200, "Actual Coinbase history must be available for this check");
  const historyBody = await history.body();
  assert(JSON.parse(historyBody.toString()).length > 0);

  const chunkPage = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  chunkPage.on("pageerror", error => errors.push(error.message));
  const chunkGate = deferred();
  let rendererDelayed = false;
  await chunkPage.route("**/*.js", async route => {
    const response = await route.fetch();
    const source = await response.text();
    if (source.includes("Chart initialization failed")) { rendererDelayed = true; await chunkGate.promise; }
    await route.fulfill({ response });
  });
  await chunkPage.route("**/api/market", route => route.fulfill({ status: 200, contentType: "application/json", body: historyBody }));
  await chunkPage.goto(url, { waitUntil: "domcontentloaded" });
  await expect(chunkPage.locator(`${loadedSelector} .market-price strong`)).toBeVisible();
  await expect(chunkPage.getByRole("status", { name: "Starting reference chart", exact: true })).toBeVisible();
  assert(rendererDelayed);
  assert.equal(await chunkPage.locator(`${loadedSelector} .chart-frame [data-loading]`).count(), 1);
  chunkGate.release();
  await expect(chunkPage.locator(`${loadedSelector} .chart-frame [data-loading]`)).toHaveCount(0);
  await chunkPage.close();

  for (const width of [320, 375, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    const gate = deferred();
    await page.route("**/api/market", async route => {
      await gate.promise;
      await route.fulfill({ status: 200, contentType: "application/json", body: historyBody });
    });
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "Create room", exact: true })).toBeVisible({ timeout: 20_000 });
    const skeleton = page.locator(`${loadedSelector} .chart-frame [data-loading]`);
    await expect(skeleton).toBeVisible();
    await page.locator(loadedSelector).scrollIntoViewIfNeeded();
    const before = await geometry(page);
    assert.equal(before.overflow, false);
    assert.equal(await skeleton.locator("[data-skeleton]").count(), 12);
    assert.equal(await page.locator(".room-entry:visible [data-skeleton]").count(), 0);
    const shape = skeleton.locator("[data-skeleton]").first();
    const initialTransform = await shape.evaluate(element => getComputedStyle(element, "::after").transform);
    await expect.poll(() => shape.evaluate(element => getComputedStyle(element, "::after").transform)).not.toBe(initialTransform);
    await expect.poll(() => shape.evaluate(element => new DOMMatrixReadOnly(getComputedStyle(element, "::after").transform).m41 / element.clientWidth)).toBeGreaterThan(-0.2);
    await page.screenshot({ path: resolve(directory, `chart-${width}.png`), fullPage: true });
    await page.getByRole("button", { name: "0.005 SOL", exact: true }).click();
    await expect(page.getByLabel("Stake per player, in SOL", { exact: true })).toHaveValue("0.005");
    gate.release();
    await expect(skeleton).toHaveCount(0);
    await expect(page.locator(`${loadedSelector} .market-price [data-skeleton]`)).toHaveCount(0);
    assert(await page.locator(`${loadedSelector} canvas`).count() > 0);
    const after = await geometry(page);
    if (after.height !== before.height) console.log(JSON.stringify({ width, before, after }));
    assert.equal(after.width, before.width);
    assert.equal(after.height, before.height);
    assert.equal(after.plotHeight, before.plotHeight);
    layouts.push({ width, before, after, shimmerMoves: true, controlsUsable: true });
    await page.unroute("**/api/market");
  }

  await page.setViewportSize({ width: 1280, height: 1000 });
  const reducedGate = deferred();
  await page.route("**/api/market", async route => { await reducedGate.promise; await route.abort(); });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  const reducedShape = page.locator(`${loadedSelector} .chart-frame [data-skeleton]`).first();
  await expect(reducedShape).toBeVisible();
  assert.equal(await reducedShape.evaluate(element => getComputedStyle(element, "::after").animationName), "none");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect.poll(() => reducedShape.evaluate(element => getComputedStyle(element, "::after").animationName)).not.toBe("none");
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(await reducedShape.evaluate(element => getComputedStyle(element, "::after").animationName), "none");
  reducedGate.release();
  await expect(page.getByRole("button", { name: "Retry feed" })).toBeVisible();
  await expect(page.locator(`${loadedSelector} [data-skeleton]`)).toHaveCount(0);
  await page.screenshot({ path: resolve(directory, "feed-error.png"), fullPage: true });
  await page.unroute("**/api/market");
  await page.route("**/api/market", route => route.fulfill({ status: 200, contentType: "application/json", body: historyBody }));
  await page.getByRole("button", { name: "Retry feed" }).click();
  await expect(page.locator(`${loadedSelector} .market-price strong`)).toBeVisible();

  const roomGate = deferred();
  await page.route("**/*", async route => {
    if (route.request().method() !== "POST") { await route.fallback(); return; }
    await roomGate.promise;
    await route.abort();
  });
  await page.goto(`${url}?room=11111111111111111111111111111111`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("status", { name: "Reading room and its Solana balances", exact: true })).toBeVisible();
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: resolve(directory, `room-${width}.png`), fullPage: true });
  }
  await page.getByRole("button", { name: "Lobby", exact: true }).click();
  await expect(page.getByRole("button", { name: "Create room", exact: true })).toBeVisible();
  roomGate.release();
  await page.getByRole("button", { name: "How to play", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  assert.deepEqual(errors, []);
  writeFileSync(resolve(directory, "result.json"), JSON.stringify({ complete: true, readOnly: true, actualCoinbaseHistory: true,
    layouts, serverSkeleton: true, delayedRenderer: true, roomReadPending: true, roomNavigationDuringRead: true, liveReducedMotion: true, feedErrorAndRetry: true,
    noTransactions: true, pageErrors: errors }, null, 2));
  console.log(`Skeleton browser checks passed: ${directory}`);
} catch (error) {
  console.error(`Skeleton evidence: ${directory}`);
  for (const context of browser.contexts()) for (const page of context.pages()) {
    await page.screenshot({ path: resolve(directory, "failure.png"), fullPage: true }).catch(() => {});
  }
  throw error;
} finally { await browser.close(); }
