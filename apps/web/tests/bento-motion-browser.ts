import assert from "node:assert/strict";
import { resolve } from "node:path";
import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

export async function checkBentoMotion(page: Page, directory: string) {
  await page.setViewportSize({ width: 1280, height: 1100 });
  const section = page.locator("#onchain");
  const rollup = section.locator('[data-bento-card="rollup"]');
  const custody = section.locator('[data-bento-card="custody"]');
  const phases = () => section.locator("[data-bento-card]").evaluateAll(elements => elements.map(element => element.getAttribute("data-phase")));
  await expect(section.getByRole("button")).toHaveCount(0);
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await page.mouse.move(0, 0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(section.locator('[data-running="true"]')).toHaveCount(0);
  await expect.poll(phases).toEqual(["0", "0", "0", "0", "0"]);
  const offscreen = await phases();
  await page.waitForTimeout(600);
  assert.deepEqual(await phases(), offscreen);

  await section.scrollIntoViewIfNeeded();
  await expect(rollup).toHaveAttribute("data-running", "true");
  await expect(rollup).toHaveAttribute("data-phase", "1");
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(section.locator('[data-running="true"]')).toHaveCount(0);
  const hidden = await phases();
  await page.waitForTimeout(600);
  assert.deepEqual(await phases(), hidden);
  await rollup.screenshot({ path: resolve(directory, "rollup-phase-1.png") });
  await custody.screenshot({ path: resolve(directory, "custody-phase-1.png") });

  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  let movement;
  try {
    await page.evaluate(() => {
      Reflect.deleteProperty(document, "visibilityState");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(rollup).toHaveAttribute("data-running", "true");
    const sampling = section.evaluate(element => new Promise<{
      movingFrames: number; seatFrames: number; cardShift: number; custodyShift: number; assetShift: number; frames: number[];
    }>(resolveSample => {
      const card = element.querySelector('[data-bento-card="rollup"]')!;
      const packet = card.querySelector("[data-rollup-packet]")!;
      const base = card.querySelector("[data-rollup-custody]")!;
      const seat = element.querySelector('[data-stake-fill="3"]')!;
      const asset = element.querySelector("[data-stake-asset]")!;
      const initialAsset = asset.getBoundingClientRect();
      const initialCard = card.getBoundingClientRect();
      const initialBase = base.getBoundingClientRect();
      const samples: number[] = [];
      const seats: number[] = [];
      const frames: number[] = [];
      const start = performance.now();
      let previous = 0;
      let cardShift = 0;
      let custodyShift = 0;
      let assetShift = 0;
      const sample = (now: number) => {
        if (previous) frames.push(now - previous);
        previous = now;
        const box = card.getBoundingClientRect();
        const baseBox = base.getBoundingClientRect();
        cardShift = Math.max(cardShift, Math.abs(box.top - initialCard.top), Math.abs(box.width - initialCard.width), Math.abs(box.height - initialCard.height));
        custodyShift = Math.max(custodyShift, Math.abs(baseBox.top - initialBase.top), Math.abs(baseBox.left - initialBase.left));
        const offset = (node: Element) => {
          const transform = getComputedStyle(node).transform;
          return transform === "none" ? 0 : new DOMMatrix(transform).m42;
        };
        samples.push(offset(packet));
        const fill = getComputedStyle(seat).transform;
        seats.push(fill === "none" ? 1 : new DOMMatrix(fill).m11);
        const assetBox = asset.getBoundingClientRect();
        assetShift = Math.max(assetShift, Math.abs(assetBox.top - initialAsset.top), Math.abs(assetBox.left - initialAsset.left));
        if (now - start < 5100) requestAnimationFrame(sample);
        else resolveSample({
          movingFrames: new Set(samples.map(value => value.toFixed(2))).size,
          seatFrames: new Set(seats.map(value => value.toFixed(2))).size,
          cardShift, custodyShift, assetShift, frames,
        });
      };
      requestAnimationFrame(sample);
    }));
    for (const phase of [2, 3]) {
      await expect(rollup).toHaveAttribute("data-phase", String(phase));
      await page.waitForTimeout(350);
      await expect(rollup.locator("[data-rollup-step]")).toHaveAttribute("data-rollup-step", String(phase));
      await rollup.screenshot({ path: resolve(directory, `rollup-phase-${phase}.png`) });
    }
    movement = await sampling;
  } finally {
    await session.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    await session.detach();
  }
  assert(movement.movingFrames > 8, "The Control batch must interpolate, not jump");
  assert(movement.seatFrames > 8, "Seat fills must interpolate, not jump");
  assert(movement.assetShift < .5, "WSOL identity must not move from the center");
  assert(movement.cardShift < .5, "Outer cards must remain stationary");
  assert(movement.custodyShift < .5, "Solana custody must remain stationary");

  for (const name of ["custody", "rollup", "decision", "holders", "settlement"]) {
    await expect.poll(async () => Number(await section.locator(`[data-bento-card="${name}"]`).getAttribute("data-cycle"))).toBeGreaterThanOrEqual(1);
  }
  await expect(section.locator('[data-running="true"]')).toHaveCount(5);
  await section.screenshot({ path: resolve(directory, "bento-motion.png"), style: 'header:has(a[aria-label="FLINCH home"]), nextjs-portal { visibility: hidden; }' });
  const cycles = await section.locator("[data-bento-card]").evaluateAll(elements => elements.map(element => Number(element.getAttribute("data-cycle"))));
  await expect.poll(async () => {
    const current = await section.locator("[data-bento-card]").evaluateAll(elements => elements.map(element => Number(element.getAttribute("data-cycle"))));
    return current.every((value, index) => value > cycles[index]);
  }, { timeout: 12_000 }).toBe(true);

  const footer = page.locator("footer");
  await expect(footer.getByRole("button", { name: /background animation/ })).toHaveCount(0);

  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await expect(section.locator('[data-running="true"]')).toHaveCount(0);
  const offscreenAfter = await phases();
  await page.waitForTimeout(1800);
  assert.deepEqual(await phases(), offscreenAfter);
  await section.scrollIntoViewIfNeeded();
  await expect(rollup).toHaveAttribute("data-running", "true");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(section.locator('[data-running="true"]')).toHaveCount(0);
  await expect(section.locator('[data-bento-card="decision"]')).toHaveAttribute("data-phase", "0");
  const still = await phases();
  await page.waitForTimeout(1800);
  assert.deepEqual(await phases(), still);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(section.locator('[data-running="true"]')).toHaveCount(5);
  await page.emulateMedia({ reducedMotion: "reduce" });

  const { frames, ...geometry } = movement;
  frames.sort((a, b) => a - b);
  return { ...geometry, repeatedCycles: true, noFooterMotionControl: true, noBentoControls: true, offscreen: true, visibilityEvent: true, liveReducedMotion: true,
    frameProbe: { cpuThrottle: 4, samples: frames.length, p95Ms: Number(frames[Math.floor(frames.length * .95)].toFixed(2)),
      maximumMs: Number(frames.at(-1)!.toFixed(2)), scope: "Local Chromium animation-frame probe, not a real-device benchmark" } };
}
