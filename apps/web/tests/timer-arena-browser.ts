import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const url = process.env.FLINCH_UI_URL ?? "http://127.0.0.1:3500/play";
assert.equal(new URL(url).hostname, "127.0.0.1");
const directory = resolve(`artifacts/runs/timer-arena-${Date.now()}`);
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.FLINCH_BROWSER_EXECUTABLE });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors: string[] = [];
page.on("pageerror", error => errors.push(error.message));
const timer = page.getByRole("timer");

try {
  await page.goto(url);
  await expect(timer).toHaveAttribute("data-state", "ready");
  await page.evaluate(() => document.fonts.ready);
  const layouts = [];
  for (const width of [320, 375, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    const geometry = await timer.evaluate(element => {
      const box = element.getBoundingClientRect();
      const heading = document.querySelector("h1")!.getBoundingClientRect();
      const ring = element.querySelector("svg")!.getBoundingClientRect();
      const value = element.querySelector("strong")!.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, right: box.right, headingRight: heading.right, viewport: innerWidth,
        ringSize: ring.width, centered: Math.abs(value.x + value.width / 2 - ring.x - ring.width / 2) < 1
          && Math.abs(value.y + value.height / 2 - ring.y - ring.height / 2) < 1,
        divider: getComputedStyle(element).borderLeftWidth,
        overflow: document.documentElement.scrollWidth > innerWidth };
    });
    assert(!geometry.overflow && geometry.right <= width && geometry.headingRight < geometry.x);
    assert(geometry.centered && geometry.divider === "0px");
    assert(geometry.ringSize >= (width > 760 ? 160 : 116));
    layouts.push(geometry);
    await page.getByRole("region", { name: "Round overview" }).screenshot({ path: resolve(directory, `overview-${width}.png`) });
    const players = page.getByRole("button", { name: "Show players, 0 of 4 seats filled" });
    if (width <= 1100) await players.click();
    await page.getByRole("button", { name: "How the round works", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("button", { name: "Close rules", exact: true })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(width <= 1100 ? players : page.getByRole("button", { name: "How the round works", exact: true })).toBeFocused();
    await page.getByRole("button", { name: "0.005 SOL", exact: true }).click();
    await expect(page.getByLabel("Stake per player, in SOL")).toHaveValue("0.005");
    await expect(timer).toHaveAttribute("data-remaining-ms", "90000");
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(timer).toHaveAttribute("data-reduced-motion", "true");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(timer).toHaveAttribute("data-reduced-motion", "false");
  await page.reload();
  await expect(timer).toHaveAttribute("aria-label", "Round duration, 90 seconds");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: resolve(directory, "arena.png"), fullPage: true });
  assert.deepEqual(errors, []);
  writeFileSync(resolve(directory, "result.json"), JSON.stringify({ passed: true, url, layouts, rulesKeyboard: true, stakeEntry: true,
    liveReducedMotion: true, reload: true, errors, scope: "Production arena timer and adjacent controls; no transactions or chart fullscreen" }, null, 2));
  console.log(`Arena timer checks passed: ${directory}`);
} catch (error) {
  await page.screenshot({ path: resolve(directory, "failure.png"), fullPage: true });
  throw error;
} finally {
  await browser.close();
}
