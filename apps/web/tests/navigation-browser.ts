import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const url = process.env.FLINCH_UI_URL ?? "http://127.0.0.1:3400/play";
assert.equal(new URL(url).hostname, "127.0.0.1");
const directory = resolve(`artifacts/runs/navigation-${Date.now()}`);
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.FLINCH_BROWSER_EXECUTABLE });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors: string[] = [];
const submissions: string[] = [];
page.on("pageerror", error => errors.push(error.message));
page.on("request", request => { if (/"method"\s*:\s*"sendTransaction"/.test(request.postData() ?? "")) submissions.push(request.url()); });
const nav = page.getByRole("navigation", { name: "Main navigation" });
const game = nav.getByRole("button", { name: "The game", exact: true });
const protocol = nav.getByRole("button", { name: "Protocol", exact: true });
const help = nav.getByRole("button", { name: "How to play", exact: true });
const rules = page.locator("#navigation-rules");
const layouts = [];

async function settledPanel(id: "game" | "protocol" | "rules") {
  await expect(page.locator(`#navigation-${id}`)).toHaveCSS("opacity", "1");
  await expect.poll(async () => page.locator(".navigation-panels").evaluate(element => {
    const selected = element.querySelector<HTMLElement>('[data-open="true"]');
    return Math.abs(element.getBoundingClientRect().height - (selected?.offsetHeight ?? 0));
  })).toBeLessThan(1);
}

try {
  await page.goto(url);
  await expect(game).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".safety-strip, dialog.help-dialog")).toHaveCount(0);
  const before = await page.locator(".standoff").boundingBox();
  const frames = await page.evaluate(async () => {
    const values: number[] = [];
    document.querySelector<HTMLButtonElement>('[aria-controls="navigation-rules"]')!.click();
    const start = performance.now();
    while (performance.now() - start < 700) {
      await new Promise(requestAnimationFrame);
      values.push(document.querySelector(".navigation-panels")!.getBoundingClientRect().height);
    }
    return values;
  });
  await settledPanel("rules");
  assert(frames.some(height => height > 2 && height < frames.at(-1)! - 2));
  assert.deepEqual(await page.locator(".standoff").boundingBox(), before);
  assert.notEqual(await page.evaluate(() => document.body.style.overflow), "hidden");
  await expect(help).toBeFocused();
  await page.screenshot({ path: resolve(directory, "rules-desktop.png") });
  await page.keyboard.press("Shift+Tab");
  await expect(protocol).toBeFocused();
  await page.keyboard.press("Enter");
  await settledPanel("protocol");
  await page.keyboard.press("Tab");
  await expect(help).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("#navigation-protocol a").first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(protocol).toBeFocused();
  await page.evaluate(async () => {
    for (const id of ["game", "rules", "protocol", "rules", "game", "rules"]) {
      document.querySelector<HTMLButtonElement>(`[aria-controls="navigation-${id}"]`)!.click();
      await new Promise(resolve => setTimeout(resolve, 40));
    }
  });
  await settledPanel("rules");
  await expect(page.locator("#navigation-game, #navigation-protocol")).toHaveCount(2);
  for (const id of ["game", "protocol"]) await expect(page.locator(`#navigation-${id}`)).toHaveAttribute("inert", "");
  await page.mouse.click(12, 140);
  await expect(help).toHaveAttribute("aria-expanded", "false");

  for (const width of [320, 375, 600, 768, 1100, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => window.scrollTo(0, 0));
    if (width <= 1100) await page.getByRole("button", { name: "Open menu", exact: true }).click();
    await game.click();
    await settledPanel("game");
    const gameBounds = await page.locator(".navigation-surface").boundingBox();
    await help.click();
    await settledPanel("rules");
    const bounds = await page.locator(".navigation-surface").boundingBox();
    assert(bounds && gameBounds && bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
    assert.equal(bounds.width, gameBounds.width, "Rules use the same navbar surface");
    assert(bounds.height <= 540, "Rules stay compact");
    assert(bounds.y + bounds.height <= 900);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    for (const control of await nav.locator("button:visible").all()) {
      const rect = await control.boundingBox();
      assert(rect && rect.width >= 40 && rect.height >= 40);
      assert.equal(await control.evaluate(element => element.scrollWidth > element.clientWidth), false, "Navigation labels must fit");
    }
    await page.screenshot({ path: resolve(directory, `rules-${width}.png`) });
    await help.click();
    await expect(rules).toHaveAttribute("inert", "");
    await help.click();
    await settledPanel("rules");
    await page.keyboard.press("Escape");
    await expect(width <= 1100 ? page.getByRole("button", { name: "Open menu", exact: true }) : help).toBeFocused();
    layouts.push({ width, bounds });
  }

  await page.getByRole("button", { name: "How the round works", exact: true }).click();
  await settledPanel("rules");
  await expect(help).toBeFocused();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Read the rules", exact: true }).click();
  await settledPanel("rules");
  await expect(help).toBeFocused();
  assert((await help.boundingBox())!.y >= 0);
  await protocol.click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await settledPanel("protocol");
  await help.click();
  await settledPanel("rules");
  await expect(rules).toHaveCSS("transform", "none");
  await page.keyboard.press("Escape");
  await page.emulateMedia({ reducedMotion: "no-preference" });

  await page.setViewportSize({ width: 375, height: 540 });
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await help.click();
  await settledPanel("rules");
  await rules.locator(".navigation-note").scrollIntoViewIfNeeded();
  await expect(rules.locator(".navigation-note")).toBeInViewport();
  await page.screenshot({ path: resolve(directory, "rules-short.png") });
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(help).toHaveAttribute("aria-expanded", "false");
  const touch = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const mobile = await touch.newPage();
  await mobile.goto(url);
  await mobile.getByRole("button", { name: "Open menu", exact: true }).tap();
  await mobile.getByRole("button", { name: "How to play", exact: true }).tap();
  await expect(mobile.locator("#navigation-rules")).toHaveCSS("opacity", "1");
  await mobile.getByRole("button", { name: "How to play", exact: true }).tap();
  await expect(mobile.locator("#navigation-rules")).toHaveAttribute("inert", "");
  await touch.close();

  await page.goto(new URL("/", url).href);
  await page.getByRole("button", { name: "Read the rules", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "How to play" })).toHaveCSS("opacity", "1");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Read the rules", exact: true })).toBeFocused();
  assert.deepEqual(errors, []);
  assert.deepEqual(submissions, []);
  writeFileSync(resolve(directory, "result.json"), JSON.stringify({ url, frames, layouts, errors, submissions, noArenaModal: true, keyboard: true, touch: true, reducedMotion: true, rapidSwitching: true, rulesShortcuts: true, landingUnchanged: true }, null, 2));
  console.log(directory);
} finally {
  await browser.close();
}
