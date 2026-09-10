import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";
import { checkComponents } from "./components-browser.ts";
import { checkLayout } from "./layout-browser.ts";
import { checkPlayerRail } from "./player-rail-browser.ts";

const url = process.env.FLINCH_UI_URL ?? "http://127.0.0.1:3400/play";
assert.equal(new URL(url).hostname, "127.0.0.1");
const directory = resolve(`artifacts/runs/control-panel-${Date.now()}`);
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.FLINCH_BROWSER_EXECUTABLE });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: "no-preference" });
const errors: string[] = [];
const writes: string[] = [];
page.on("pageerror", error => errors.push(error.message));
page.setDefaultTimeout(20_000);
await page.route("**/*", async route => {
  if (route.request().method() === "POST") {
    const body = route.request().postDataJSON();
    for (const call of Array.isArray(body) ? body : [body]) {
      if (typeof call?.method === "string" && !/^get\w+$/.test(call.method)) {
        writes.push(call.method);
        return route.abort("blockedbyclient");
      }
    }
  }
  await route.continue();
});

try {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#stake")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole("button", { name: "Use maximum stake, 0.01 SOL", exact: true })).toHaveCount(1);
  assert.equal(await page.locator(".create-action svg").count(), 0);
  const components = await checkComponents(page, directory);
  const layout = await checkLayout(page, directory);
  const players = await checkPlayerRail(page, browser, url, directory);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("button", { name: "New round", exact: true }).click();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect.poll(() => page.locator(".player-rail").getAttribute("data-motion")).toBe("full");
  const terms = page.getByRole("button", { name: "Sell penalty 0.25%", exact: true });
  await terms.focus();
  const motion = await terms.evaluate(async element => {
    const trigger = element as HTMLButtonElement;
    const reveal = document.getElementById(trigger.getAttribute("aria-controls")!)!;
    const bounds = trigger.getBoundingClientRect();
    const frames: { time: number; height: number; top: number; opacity: number }[] = [];
    const start = performance.now();
    trigger.click();
    await new Promise<void>(resolve => {
      const frame = () => {
        const time = performance.now() - start;
        frames.push({ time, height: reveal.getBoundingClientRect().height, top: trigger.getBoundingClientRect().top, opacity: Number(getComputedStyle(reveal).opacity) });
        if (time < 650) requestAnimationFrame(frame); else resolve();
      };
      requestAnimationFrame(frame);
    });
    return { frames, initialTop: bounds.top, finalHeight: reveal.getBoundingClientRect().height };
  });
  assert(motion.finalHeight > 150);
  assert(motion.frames.filter(frame => frame.height > 2 && frame.height < motion.finalHeight - 2).length >= 4, "Terms need real intermediate spring frames");
  assert(motion.frames.every(frame => Math.abs(frame.top - motion.initialTop) < 1), "Expansion must remain anchored to the trigger");
  await page.locator(".lobby-section").screenshot({ path: resolve(directory, "terms-open.png") });
  await terms.press("Escape");
  await expect(terms).toHaveAttribute("aria-expanded", "false");
  await expect(terms).toBeFocused();
  const id = await terms.getAttribute("aria-controls");
  const reveal = page.locator(`[id="${id}"]`);
  await expect.poll(() => reveal.evaluate(element => element.getBoundingClientRect().height)).toBe(0);
  const reversal = await terms.evaluate(async element => {
    const trigger = element as HTMLButtonElement;
    const reveal = document.getElementById(trigger.getAttribute("aria-controls")!)!;
    const samples: number[] = [];
    trigger.click();
    await new Promise<void>(resolve => {
      let count = 0;
      const frame = () => {
        samples.push(reveal.getBoundingClientRect().height);
        if (++count === 6) trigger.click();
        if (count < 50) requestAnimationFrame(frame); else resolve();
      };
      requestAnimationFrame(frame);
    });
    return samples;
  });
  assert(Math.max(...reversal) > 5);
  assert(reversal.at(-1)! < 1);
  assert(reversal.slice(7, -1).some((height, index) => height < reversal[index + 7 - 1]), "Reversal must animate towards the closed state");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => page.locator(".player-rail").getAttribute("data-motion")).toBe("reduced");
  await terms.click();
  await expect(terms).toHaveAttribute("aria-expanded", "true");
  await expect.poll(() => reveal.evaluate(element => Number(getComputedStyle(element).opacity))).toBe(1);
  assert.equal(await reveal.evaluate(element => element.getAnimations({ subtree: true }).filter(animation => animation.playState === "running").length), 0);
  await terms.click();
  await expect.poll(() => reveal.evaluate(element => element.getBoundingClientRect().height)).toBe(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const intervals = await terms.evaluate(async element => {
    const times: number[] = [];
    (element as HTMLButtonElement).click();
    await new Promise<void>(resolve => {
      const frame = (time: number) => { times.push(time); if (times.length < 60) requestAnimationFrame(frame); else resolve(); };
      requestAnimationFrame(frame);
    });
    return times.slice(1).map((time, index) => time - times[index]).sort((a, b) => a - b);
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await terms.click();
  for (const width of [320, 375, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole("button", { name: "Have a room code?", exact: true }).click();
    const invite = page.getByLabel("Room address or invite link", { exact: true });
    await invite.fill("unfinished-room");
    await page.getByRole("button", { name: "New round", exact: true }).click();
    await page.getByRole("button", { name: "Have a room code?", exact: true }).click();
    await expect(invite).toHaveValue("unfinished-room");
    await expect(page.getByRole("button", { name: "Open room", exact: true })).toBeEnabled();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.locator(".lobby-section").screenshot({ path: resolve(directory, `invite-${width}.png`) });
    await page.getByRole("button", { name: "New round", exact: true }).click();
  }
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: resolve(directory, "desktop.png") });
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  writeFileSync(resolve(directory, "result.json"), JSON.stringify({ complete: true, url, components, layout, players, motion, reversal,
    reducedMotion: true, preservedDrafts: true, noTransactions: true, writes, errors,
    cpu4x: { p95: intervals[Math.floor(intervals.length * .95)], max: intervals.at(-1) } }, null, 2));
  console.log(`Control panel passed: ${directory}`);
} catch (error) {
  await page.screenshot({ path: resolve(directory, "failure.png"), fullPage: true });
  console.error(`Control panel evidence: ${directory}`);
  throw error;
} finally { await browser.close(); }
