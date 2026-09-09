import assert from "node:assert/strict";
import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

export async function checkTimerSync(page: Page, url: string) {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(`${url}?sync`);
  await page.waitForFunction(() => !!window.timerTest);
  const timer = page.getByRole("timer");
  const result = await timer.evaluate(element => new Promise<{ seconds: number[]; maxMismatchMs: number; frames: number; shift: number }>(done => {
    const start = performance.now();
    const initial = element.getBoundingClientRect();
    const samples = [{ at: 500, chain: 1026 }, { at: 1700, chain: 1024 }, { at: 2400, chain: 1026 },
      { at: 3100, chain: 1029 }, { at: 4700, chain: 1030 }, { at: 6100, chain: 1029 }];
    const seconds: number[] = [];
    let maxMismatchMs = 0;
    let frames = 0;
    let shift = 0;
    const sample = () => {
      const elapsed = performance.now() - start;
      if (samples[0] && elapsed >= samples[0].at) window.timerTest.observe(samples.shift()!.chain);
      const rays = [...element.querySelectorAll("svg g line:last-child")];
      const ringMs = rays.reduce((sum, ray) => sum + Number(getComputedStyle(ray).opacity), 0) / 72 * 90_000;
      const second = Number(element.querySelector("[data-seconds]")!.getAttribute("data-seconds"));
      maxMismatchMs = Math.max(maxMismatchMs, ringMs - second * 1000, (second - 1) * 1000 - ringMs);
      if (seconds.at(-1) !== second) seconds.push(second);
      const box = element.getBoundingClientRect();
      shift = Math.max(shift, Math.abs(box.x - initial.x), Math.abs(box.width - initial.width));
      frames++;
      if (elapsed < 8000) requestAnimationFrame(sample);
      else done({ seconds, maxMismatchMs, frames, shift });
    };
    requestAnimationFrame(sample);
  }));
  assert(result.frames > 100);
  assert(result.maxMismatchMs < 40, `Ring/number lag: ${result.maxMismatchMs}ms`);
  assert(result.shift < .5);
  assert(result.seconds.length >= 8);
  assert(result.seconds.every((value, index) => index === 0 || value === result.seconds[index - 1] - 1), JSON.stringify(result.seconds));
  await page.clock.install({ time: new Date("2026-09-11T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-09-11T00:01:00Z"));
  await page.evaluate(() => window.timerTest.reset(2000, 2020));
  await expect(timer.locator("[data-seconds]")).toHaveAttribute("data-seconds", "70");
  await page.clock.runFor(2000);
  await expect(timer.locator("[data-seconds]")).toHaveAttribute("data-seconds", "68");
  await page.clock.setSystemTime(new Date("2026-09-12T00:01:00Z"));
  await page.clock.runFor(1000);
  await expect(timer.locator("[data-seconds]")).toHaveAttribute("data-seconds", "67");
  await page.evaluate(() => window.timerTest.stale(true));
  await expect(timer).toHaveAttribute("data-state", "stale");
  await page.clock.fastForward(20_000);
  await expect(timer.locator("[data-seconds]")).toHaveAttribute("data-seconds", "47");
  await page.evaluate(() => { window.timerTest.observe(2046, 1000); window.timerTest.stale(false); });
  await page.clock.runFor(1000);
  await expect(timer.locator("[data-seconds]")).toHaveAttribute("data-seconds", "46");
  await page.evaluate(() => window.timerTest.observe(2090));
  await expect(timer.locator("[data-seconds]")).toHaveAttribute("data-seconds", "0");
  await expect(timer).not.toHaveAttribute("data-state", "ended");
  await page.clock.runFor(32);
  assert(await timer.locator("svg g line:last-child").evaluateAll(rays => rays.every(ray => Number(getComputedStyle(ray).opacity) === 0)));
  await page.evaluate(() => window.timerTest.end());
  await expect(timer).toHaveAttribute("data-state", "ended");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => window.timerTest.reset(3000, 3000));
  await page.clock.runFor(1000);
  await expect(timer.locator("[data-seconds]")).toHaveAttribute("data-seconds", "89");
  assert(await timer.locator('[class*="glyph"]').evaluateAll(glyphs => getComputedStyle(glyphs[0]).transform === "none"));
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.runFor(5000);
  await expect(timer.locator("[data-seconds]")).toHaveAttribute("data-seconds", "89");
  await page.evaluate(() => {
    Reflect.deleteProperty(document, "hidden");
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(timer.locator("[data-seconds]")).toHaveAttribute("data-seconds", "84");
  return { ...result, systemClockChange: true, suspension: true, visibilityResume: true, staleRecovery: true, expiry: true, newRoom: true };
}
