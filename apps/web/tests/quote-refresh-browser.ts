import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, expect } from "@playwright/test";

declare global {
  interface Window {
    quoteTest: { reads: number; prompts: number; sends: number; fail: boolean; available: boolean; reserve: bigint; release?: (reject: boolean) => void };
  }
}

const require = createRequire(import.meta.url);
Object.assign(process.env, { NODE_ENV: "production" });
const vitePath = require.resolve("vite", { paths: [dirname(require.resolve("vitest"))] });
const { createServer } = await import(pathToFileURL(vitePath).href);
const directory = resolve(`artifacts/runs/quote-refresh-${Date.now()}`);
mkdirSync(directory, { recursive: true });
const server = await createServer({ configFile: false, mode: "production", root: resolve("apps/web"),
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  server: { host: "127.0.0.1", port: 0, watch: { ignored: ["**/.next/**"] } },
  resolve: { alias: { buffer: require.resolve("buffer/", { paths: [dirname(require.resolve("@solana/web3.js"))] }),
    "next/image": resolve("apps/web/tests/number-preview-image.tsx") } },
  optimizeDeps: { entries: ["tests/quote-refresh-fixture.tsx"], include: ["buffer"] },
  oxc: { jsx: { runtime: "automatic", development: false } }, css: { postcss: { plugins: [] } },
  plugins: [{ name: "quote-refresh-fixture", configureServer(instance: typeof server) {
    instance.middlewares.use("/quote.html", async (_request: unknown, response: { setHeader: (key: string, value: string) => void; end: (body: string) => void }) => {
      response.setHeader("Content-Type", "text/html");
      response.end(await instance.transformIndexHtml("/quote.html", '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Quote checks</title></head><body><div id="root"></div><script type="module">import { Buffer } from "buffer"; window.Buffer = Buffer; window.process = { env: {} }; await import("/tests/quote-refresh-fixture.tsx");</script></body></html>'));
    });
  } }] });
await server.listen();
const address = server.httpServer.address();
const browser = await chromium.launch({ executablePath: process.env.FLINCH_BROWSER_EXECUTABLE });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors: string[] = [];
const posts: string[] = [];
page.on("pageerror", error => errors.push(error.message));
page.on("request", request => { if (request.method() === "POST") posts.push(request.url()); });
page.setDefaultTimeout(15_000);
const counts = () => page.evaluate(() => ({ reads: window.quoteTest.reads, prompts: window.quoteTest.prompts, sends: window.quoteTest.sends }));
const sell = page.getByRole("button", { name: "Queue SELL · wallet approval", exact: true });
try {
  await page.goto(`http://127.0.0.1:${address.port}/quote.html`);
  await expect(sell).toBeEnabled({ timeout: 15000 });
  await expect.poll(async () => (await counts()).reads).toBeGreaterThanOrEqual(4);
  assert.equal((await counts()).prompts, 0);
  assert.equal((await counts()).sends, 0);
  await expect(page.getByText("Quotes refresh automatically", { exact: true })).toBeVisible();
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const box = await sell.boundingBox();
    assert(box && box.width >= 40 && box.height >= 40);
    await sell.focus();
    assert(await sell.evaluate(element => getComputedStyle(element).outlineStyle !== "none"));
    await page.locator(".room-controls").screenshot({ path: resolve(directory, `automatic-${width}.png`) });
  }
  await page.evaluate(() => { Object.defineProperty(navigator, "onLine", { configurable: true, value: false }); window.dispatchEvent(new Event("offline")); });
  await expect(sell).toBeDisabled();
  const paused = (await counts()).reads;
  await page.waitForTimeout(2300);
  assert.equal((await counts()).reads, paused);
  await page.evaluate(() => { Object.defineProperty(navigator, "onLine", { configurable: true, value: true }); window.dispatchEvent(new Event("online")); });
  await expect(sell).toBeEnabled();
  await expect.poll(async () => (await counts()).reads).toBeGreaterThan(paused);
  await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(sell).toBeDisabled();
  const hidden = (await counts()).reads;
  await page.waitForTimeout(1500);
  assert.equal((await counts()).reads, hidden);
  await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(sell).toBeEnabled();
  await expect.poll(async () => (await counts()).reads).toBeGreaterThan(hidden);
  await page.evaluate(() => { window.quoteTest.fail = true; });
  await expect(page.getByText("Price unavailable. Retrying…", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again", exact: true })).toBeVisible();
  await page.evaluate(() => { window.quoteTest.fail = false; });
  await expect(page.getByText("Quotes refresh automatically", { exact: true })).toBeVisible();
  assert.equal((await counts()).prompts, 0);
  await sell.focus();
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await counts()).prompts).toBe(1);
  await expect(sell).toBeDisabled();
  const approvedMinimum = await page.locator(".quote-breakdown dl").first().innerText();
  const approving = (await counts()).reads;
  await page.waitForTimeout(3000);
  assert.equal((await counts()).reads, approving);
  assert.equal(await page.locator(".quote-breakdown dl").first().innerText(), approvedMinimum);
  await page.evaluate(() => window.quoteTest.release?.(true));
  await expect(sell).toBeEnabled();
  assert.equal((await counts()).sends, 0);
  await expect.poll(async () => (await counts()).reads).toBeGreaterThan(approving);
  await sell.click();
  await expect.poll(async () => (await counts()).prompts).toBe(2);
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.quoteTest.release?.(false));
  await expect.poll(async () => (await counts()).sends).toBe(1);
  await expect(page.getByRole("heading", { name: "Sell queued", exact: true })).toBeVisible();
  assert.equal((await counts()).prompts, 2);
  await expect(page.getByText("Quote expired", { exact: true })).toHaveCount(0);
  assert.deepEqual(posts, []);
  assert.deepEqual(errors, []);
  writeFileSync(resolve(directory, "result.json"), JSON.stringify({ passed: true, counts: await counts(),
    automatic: true, offlineResume: true, hiddenResume: true, failedReadRecovery: true, cancelledApproval: true, slowApproval: true,
    minimumFrozen: true, responsiveWidths: [375, 768, 1280], nativeKeyboard: true,
    scope: "Real UI and signing flow with isolated test data and mock RPC; no onchain transactions" }, null, 2));
  console.log(`Quote refresh browser passed: ${directory}`);
} catch (error) {
  await page.screenshot({ path: resolve(directory, "failure.png"), fullPage: true });
  console.error(`Quote refresh evidence: ${directory}`, errors);
  throw error;
} finally {
  await browser.close();
  await server.close();
}
