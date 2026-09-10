import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import type { Page } from "@playwright/test";

const require = createRequire(new URL("../package.json", import.meta.url));
const sharp = createRequire(require.resolve("next/package.json"))("sharp");

function luminance(channels: number[]) {
  const linear = channels.map(value => value / 255 <= .04045 ? value / 255 / 12.92 : ((value / 255 + .055) / 1.055) ** 2.4);
  return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
}

export async function checkLandingRendering(page: Page, directory: string) {
  const contrast = [];
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
    await page.locator('[data-hero-art="standoff"] svg').waitFor({ state: "visible" });
    const regions = await page.locator('section[aria-labelledby="landing-title"] h1, section[aria-labelledby="landing-title"] h1 span, section[aria-labelledby="landing-title"] p').evaluateAll(elements => elements.map(element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return { text: element.textContent, x: rect.x, y: rect.y, width: rect.width, height: rect.height,
        color: style.color.match(/[\d.]+/g)!.slice(0, 3).map(Number), large: Number.parseFloat(style.fontSize) >= 24 };
    }));
    const content = page.locator('section[aria-labelledby="landing-title"] > :not([aria-hidden])');
    await content.evaluateAll(elements => elements.forEach(element => { (element as HTMLElement).style.visibility = "hidden"; }));
    let png: Buffer;
    try { png = await page.screenshot(); } finally {
      await content.evaluateAll(elements => elements.forEach(element => { (element as HTMLElement).style.removeProperty("visibility"); }));
    }
    const pixels = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    for (const region of regions) {
      const foreground = luminance(region.color);
      let minimum = Infinity;
      for (let y = Math.max(0, Math.floor(region.y)); y < Math.min(900, region.y + region.height); y += 2) {
        for (let x = Math.max(0, Math.floor(region.x)); x < Math.min(width, region.x + region.width); x += 2) {
          const offset = (y * pixels.info.width + x) * pixels.info.channels;
          const background = luminance([pixels.data[offset], pixels.data[offset + 1], pixels.data[offset + 2]]);
          minimum = Math.min(minimum, (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05));
        }
      }
      assert(minimum >= (region.large ? 3 : 4.5), `${width}px hero contrast ${minimum.toFixed(2)}: ${region.text}`);
      contrast.push({ width, text: region.text, minimumRatio: Number(minimum.toFixed(2)) });
    }
  }
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  let frames: number[];
  try {
    frames = await page.evaluate(() => new Promise<number[]>(resolveFrames => {
      const samples: number[] = [];
      let previous = 0;
      let frame = 0;
      const sample = (now: number) => {
        if (previous) samples.push(now - previous);
        previous = now;
        scrollTo({ top: 2400 * frame / 90, behavior: "instant" });
        if (++frame < 90) requestAnimationFrame(sample);
        else resolveFrames(samples);
      };
      requestAnimationFrame(sample);
    }));
  } finally {
    await session.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    await session.detach();
    await page.emulateMedia({ reducedMotion: "reduce" });
  }
  await page.locator('[data-bento-card="rollup"]').evaluate(element => element.scrollIntoView({ block: "center", behavior: "instant" }));
  await page.screenshot({ path: resolve(directory, "scroll-review.png") });
  frames.sort((a, b) => a - b);
  return { contrast, scrollProbe: { cpuThrottle: 4, samples: frames.length,
    p95FrameIntervalMs: Number(frames[Math.floor(frames.length * .95)].toFixed(2)),
    maximumFrameIntervalMs: Number(frames.at(-1)!.toFixed(2)), scope: "Local Chromium animation-frame probe, not a real-device benchmark" } };
}
