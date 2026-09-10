import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, expect } from "@playwright/test";

const require = createRequire(import.meta.url);
const vitePath = require.resolve("vite", { paths: [dirname(require.resolve("vitest"))] });
const { createServer } = await import(pathToFileURL(vitePath).href);
const directory = resolve(`artifacts/runs/room-tickets-${Date.now()}`);
mkdirSync(directory, { recursive: true });
const server = await createServer({ configFile: false, root: resolve("apps/web"), server: { host: "127.0.0.1", port: 0, watch: { ignored: ["**/.next/**"] } },
  resolve: { alias: { buffer: require.resolve("buffer/", { paths: [dirname(require.resolve("@solana/web3.js"))] }),
    "next/image": resolve("apps/web/tests/number-preview-image.tsx") } },
  optimizeDeps: { entries: ["tests/room-tickets-fixture.tsx"], include: ["buffer"] },
  esbuild: { jsx: "automatic" }, css: { postcss: { plugins: [] } },
  plugins: [{ name: "room-ticket-fixture", configureServer(instance: typeof server) {
    instance.middlewares.use("/tickets.html", async (_request: unknown, response: { setHeader: (key: string, value: string) => void; end: (body: string) => void }) => {
      response.setHeader("Content-Type", "text/html");
      response.end(await instance.transformIndexHtml("/tickets.html", '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Room ticket test</title></head><body><div id="root"></div><script type="module">import { Buffer } from "buffer"; window.Buffer = Buffer; window.process = { env: {} }; await import("/tests/room-tickets-fixture.tsx");</script></body></html>'));
    });
  } }] });
await server.listen();
const address = server.httpServer.address();
const browser = await chromium.launch({ executablePath: process.env.FLINCH_BROWSER_EXECUTABLE });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: "no-preference" });
const errors: string[] = [];
const posts: string[] = [];
page.on("pageerror", error => errors.push(error.message));
page.on("request", request => { if (request.method() === "POST") posts.push(request.url()); });
page.setDefaultTimeout(15_000);
const panel = page.locator(".room-controls");
const state = async (name: string) => { await page.getByRole("button", { name, exact: true }).click(); };
const geometry: unknown[] = [];
try {
  await page.goto(`http://127.0.0.1:${address.port}/tickets.html`);
  await expect(panel).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  for (const width of [320, 375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const name of ["entry", "joined", "full", "expired", "refund", "usdc", "claimed", "recovery", "sell", "quote", "stale", "loading", "precision"]) {
      await state(name);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name} page overflows at ${width}`);
      assert(await panel.evaluate(element => element.scrollWidth <= element.clientWidth), `${name} card overflows at ${width}`);
      const bounds = await panel.boundingBox();
      assert(bounds);
      if (name === "joined" && width === 1280) {
        const chart = await page.locator(".fixture-chart").boundingBox();
        assert(chart && bounds.height < chart.height - 32, "Joined card must not stretch to chart height");
      }
      for (const button of await panel.getByRole("button").all()) {
        if (!await button.isVisible()) continue;
        const box = await button.boundingBox();
        assert(box && box.height >= 40 && box.width >= 40, `${name} small hit target at ${width}`);
      }
      geometry.push({ width, state: name, height: bounds.height });
      await panel.screenshot({ path: resolve(directory, `${name}-${width}.png`) });
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await state("entry");
  const toggle = panel.getByRole("checkbox");
  await expect(toggle).toBeChecked();
  await toggle.focus();
  await page.keyboard.press("Space");
  await expect(toggle).not.toBeChecked();
  const toggleBox = await toggle.boundingBox();
  assert(toggleBox && toggleBox.width === 36 && toggleBox.height === 22);
  await state("joined");
  const summary = panel.locator("summary", { hasText: "Room & session controls" });
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(panel.getByRole("button", { name: "Cancel room", exact: true })).toBeVisible();
  const disclosure = panel.locator("details");
  await expect.poll(() => disclosure.evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
  await page.keyboard.press("Enter");
  const heights = await disclosure.evaluate(element => new Promise<number[]>(done => {
    const values: number[] = [];
    const start = performance.now();
    const sample = () => { values.push(element.getBoundingClientRect().height); if (performance.now() - start < 400) requestAnimationFrame(sample); else done(values); };
    requestAnimationFrame(sample);
  }));
  assert(new Set(heights.map(value => value.toFixed(1))).size > 4, "Disclosure must interpolate closed height");
  await summary.click();
  await summary.click();
  await expect(disclosure).not.toHaveAttribute("open");
  await expect.poll(() => disclosure.evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await summary.click();
  assert.equal(await summary.locator("svg").evaluate(element => getComputedStyle(element).transitionDuration), "0s");
  assert.equal(await disclosure.evaluate(element => element.getAnimations({ subtree: true }).length), 0);
  await state("refund");
  const claim = panel.getByRole("button", { name: "Claim WSOL", exact: true });
  await claim.click();
  await expect(claim).toBeDisabled();
  await expect(claim).toHaveAttribute("aria-busy", "true");
  await expect(panel.getByText("0.004", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Mock requests")).toHaveText("1");
  await expect(panel.getByRole("status")).toContainText("Waiting for wallet and Solana confirmation");
  await page.getByRole("button", { name: "Reject approval" }).click();
  await expect(claim).toBeEnabled();
  await expect(panel.getByText("0.004", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Toggle pending" }).click();
  await expect(claim).toBeDisabled();
  await expect(panel.getByRole("status")).toContainText("Unconfirmed. Use Check transaction");
  const details = panel.locator("summary", { hasText: "Withdrawal details" });
  await details.focus();
  await page.keyboard.press("Enter");
  await expect(panel.getByText("WSOL stays wrapped after claiming.")).toBeVisible();
  await state("stale");
  await expect(panel.getByRole("button", { name: "Queue SELL · session key", exact: true })).toBeDisabled();
  await state("loading");
  await expect(panel.getByLabel("Reading pool reserves", { exact: true })).toBeVisible();
  assert.deepEqual(posts, []);
  assert.deepEqual(errors, []);
  writeFileSync(resolve(directory, "result.json"), JSON.stringify({ passed: true, geometry, disclosureFrames: heights,
    reducedMotion: true, interruptedDisclosure: true, exactPendingAmount: true, rejectionPreservesAmount: true,
    nativeKeyboard: true, noNetworkPosts: true, scope: "Isolated real components with mock data and approval; no transactions" }, null, 2));
  console.log(`Room ticket checks passed: ${directory}`);
} catch (error) {
  await page.screenshot({ path: resolve(directory, "failure.png"), fullPage: true });
  console.error(`Room ticket evidence: ${directory}`, errors);
  throw error;
} finally {
  await browser.close();
  await server.close();
}
