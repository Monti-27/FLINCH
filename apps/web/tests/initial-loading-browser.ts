import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const url = new URL(process.env.FLINCH_UI_URL ?? "http://127.0.0.1:3400/play");
assert.equal(url.hostname, "127.0.0.1");
assert.equal(url.pathname, "/play");
const lobby = new URL("/play", url);
const room = new URL(url);
if (!room.searchParams.has("room")) room.searchParams.set("room", "11111111111111111111111111111111");
const directory = resolve(`artifacts/runs/initial-loading-${Date.now()}`);
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.FLINCH_BROWSER_EXECUTABLE });
const results: unknown[] = [];

try {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  for (const [name, target] of [["lobby", lobby], ["room", room]] as const) {
    for (const width of [375, 768, 1512]) {
      await page.setViewportSize({ width, height: 982 });
      const response = await page.goto(target.href);
      assert.equal(response?.status(), 200);
      await expect(page.locator(".panel.skeleton")).toHaveCount(0);
      await expect(page.locator("[data-arena-loading]:visible")).toHaveCount(1);
      await expect(page.getByRole("link", { name: "FLINCH home", exact: true })).toBeVisible();
      const shapes = await page.locator("[data-arena-loading]:visible [data-skeleton]").count();
      assert(shapes > 40);
      const loadingText = await page.getByText("Loading FLINCH…", { exact: true }).evaluateAll(nodes => nodes.map(node => {
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return { width: rect.width, height: rect.height, clip: style.clip, screenReaderOnly: node.classList.contains("sr-only") };
      }));
      assert(loadingText.length > 0);
      assert(loadingText.every(text => text.screenReaderOnly && text.width <= 1 && text.height <= 1 && text.clip === "rect(0px, 0px, 0px, 0px)"));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: resolve(directory, `${name}-${width}.png`), fullPage: true });
      results.push({ route: name, width, shapes, oldPanelAbsent: true, loadingText });
    }
  }
  writeFileSync(resolve(directory, "result.json"), JSON.stringify({ complete: true, javaScriptDisabled: true, noTransactions: true, results }, null, 2));
  console.log(`First-paint checks passed: ${directory}`);
} finally { await browser.close(); }
