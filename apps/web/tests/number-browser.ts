import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const require = createRequire(import.meta.resolve("vitest/config"));
const { createServer } = await import(require.resolve("vite"));
const server = await createServer({ root: resolve("apps/web"), configFile: false,
  resolve: { alias: { "@flinch/client": resolve("packages/client/src/amounts.ts"), "next/image": resolve("apps/web/tests/number-preview-image.tsx") } },
  server: { host: "127.0.0.1", port: 0, watch: null }, appType: "custom" });
server.middlewares.use((request: { url: string }, response: { setHeader: (key: string, value: string) => void; end: (body: string) => void }, next: () => void) => {
  if (request.url !== "/") return next();
  response.setHeader("Content-Type", "text/html");
  response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Number test</title></head><body><div id="root"></div><script type="module" src="/tests/number-preview.tsx"></script></body></html>');
});
await server.listen();
const address = server.httpServer.address();
assert(address && typeof address === "object");
const url = `http://127.0.0.1:${address.port}`;
const directory = resolve(`artifacts/runs/number-flow-${Date.now()}`);
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.FLINCH_BROWSER_EXECUTABLE });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const errors: string[] = [];
page.on("pageerror", error => errors.push(error.message));
page.setDefaultTimeout(10_000);

try {
  await page.goto(url);
  const primary = page.getByTestId("primary").locator("[data-number-value]");
  const digits = primary.locator("number-flow-react");
  const input = page.getByLabel("Display value");
  await expect(primary).toHaveAttribute("data-number-motion", "enabled");
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await digits.evaluate(element => getComputedStyle(element).fontSize), "48px");
  await expect(primary).toHaveAttribute("data-number-direction", "neutral");
  await expect(digits).toHaveAttribute("aria-label", "$142.10");
  await expect(page.getByTestId("primary").getByRole("img", { name: "$142.10", exact: true })).toHaveCount(1);
  const before = await primary.boundingBox();
  assert(before);
  await page.getByRole("button", { name: "Increase", exact: true }).click();
  await expect(primary).toHaveAttribute("data-number-direction", "up");
  await expect(digits).toHaveAttribute("aria-label", "$143.10");
  await expect.poll(() => digits.evaluate(element => element.shadowRoot!.getAnimations().length)).toBeGreaterThan(0);
  await expect.poll(() => primary.evaluate(element => getComputedStyle(element).color)).toBe("rgb(166, 207, 187)");
  await page.screenshot({ path: resolve(directory, "increase.png") });
  await page.waitForTimeout(650);
  await page.getByRole("button", { name: "Increase again", exact: true }).click();
  await page.waitForTimeout(500);
  await expect(primary).toHaveAttribute("data-number-direction", "up");
  await expect(primary).toHaveAttribute("data-number-direction", "neutral", { timeout: 2000 });
  assert.equal((await primary.boundingBox())!.width, before.width);
  await page.getByRole("button", { name: "Decrease", exact: true }).click();
  await expect(primary).toHaveAttribute("data-number-direction", "down");
  await expect.poll(() => primary.evaluate(element => getComputedStyle(element).color)).toBe("rgb(238, 167, 175)");
  await page.screenshot({ path: resolve(directory, "decrease.png") });
  await expect(page.getByTestId("neutral").locator("[data-number-value]")).toHaveAttribute("data-number-direction", "neutral");
  for (const value of ["999.99", "1000.00", "-0.01", "0.00", "18446744073.709551614", "18446744073.709551615"]) {
    await input.fill(value);
    await expect(digits).toHaveAttribute("aria-label", `$${value}`);
  }
  await expect(primary).toHaveAttribute("data-number-direction", "up");
  await input.fill("18446744073.709551614");
  await expect(primary).toHaveAttribute("data-number-direction", "down");
  await expect.poll(() => digits.evaluate(element => [...element.shadowRoot!.querySelectorAll(".digit__num:not([inert]), .symbol__value:not([inert])")].map(node => node.textContent).join(""))).toBe("$18446744073.709551614");
  await page.getByRole("button", { name: "No data", exact: true }).click();
  await expect(primary).toHaveAttribute("data-number-direction", "neutral");
  await expect(digits).toHaveCount(0);
  await input.fill("100.00");
  await expect(primary).toHaveAttribute("data-number-direction", "neutral");
  await page.getByRole("button", { name: "Change account", exact: true }).click();
  await expect(digits).toHaveAttribute("aria-label", "$240.00");
  await expect(primary).toHaveAttribute("data-number-direction", "neutral");
  await page.getByRole("button", { name: "Increase", exact: true }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(primary).toHaveAttribute("data-number-motion", "disabled");
  await expect(primary).toHaveAttribute("data-number-direction", "neutral");
  await input.fill("145.10");
  await expect(digits).toHaveAttribute("aria-label", "$145.10");
  assert.equal(await digits.evaluate(element => element.shadowRoot!.getAnimations().length), 0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(primary).toHaveAttribute("data-number-motion", "enabled");
  await expect(primary).toHaveAttribute("data-number-direction", "neutral");
  await input.fill("142.10");
  await page.getByRole("button", { name: "Add one lamport", exact: true }).click();
  await expect(page.locator('.position-balance [data-number-value="0.001000001"]')).toHaveAttribute("data-number-direction", "up");
  const layouts = [];
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(primary).toHaveAttribute("data-number-direction", "neutral");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await expect(page.locator('.position-balance number-flow-react')).toHaveAttribute("aria-label", "0.001000001");
    await page.screenshot({ path: resolve(directory, `numbers-${width}.png`), fullPage: true });
    layouts.push({ width, overflow: false });
  }
  await page.getByRole("button", { name: "Increase", exact: true }).click();
  await page.getByRole("button", { name: "Toggle number", exact: true }).click();
  await page.waitForTimeout(1100);
  await expect(primary).toHaveCount(0);
  await page.getByRole("button", { name: "Toggle number", exact: true }).click();
  await expect(primary).toHaveAttribute("data-number-direction", "neutral");
  assert.deepEqual(errors, []);
  writeFileSync(resolve(directory, "result.json"), JSON.stringify({ complete: true, isolatedFixture: true, transactions: 0,
    digitMotion: true, directionalColors: true, repeatedUpdates: true, exactU64: true, smallestUnit: true,
    missingData: true, identityReset: true, liveReducedMotion: true, unmount: true, layouts, pageErrors: errors }, null, 2));
  console.log(`Number checks passed: ${directory}`);
} catch (error) {
  await page.screenshot({ path: resolve(directory, "failure.png"), fullPage: true });
  console.error(`Number evidence: ${directory}`, errors);
  throw error;
} finally {
  await browser.close();
  await server.close();
}
