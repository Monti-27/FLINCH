import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";
import { checkBentoMotion } from "./bento-motion-browser.ts";
import { checkBentoContainment } from "./bento-containment-browser.ts";

const url = process.env.FLINCH_LANDING_URL ?? "http://127.0.0.1:3000";
assert.equal(new URL(url).hostname, "127.0.0.1", "Bento checks only run against loopback");
const directory = resolve(`artifacts/runs/bento-${Date.now()}`);
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.FLINCH_BROWSER_EXECUTABLE });
const page = await browser.newPage({ viewport: { width: 1280, height: 1100 }, reducedMotion: "reduce" });
const errors: string[] = [];
const requests: string[] = [];
page.on("pageerror", error => errors.push(error.message));
page.on("request", request => requests.push(request.url()));
page.setDefaultTimeout(15_000);

try {
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  const section = page.locator("#onchain");
  const cards = section.locator("[data-bento-card]");
  await expect(cards).toHaveCount(5);
  await expect(section.getByRole("button")).toHaveCount(0);
  const layouts = [];
  for (const width of [320, 375, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 1100 });
    await section.scrollIntoViewIfNeeded();
    await section.locator("img").evaluateAll(async images => {
      await Promise.all(images.map(image => (image as HTMLImageElement).decode()));
    });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px overflow`);
    const rects = await cards.evaluateAll(elements => elements.map(element => {
      const box = element.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    }));
    if (width > 900) {
      assert.equal(rects[0].y, rects[1].y);
      assert.equal(rects[1].y, rects[2].y);
      assert.equal(rects[3].y, rects[4].y);
      assert(rects[3].width > rects[0].width * 1.4);
    } else if (width > 620) {
      assert.equal(rects[0].y, rects[1].y);
      assert.equal(rects[2].y, rects[3].y);
      assert(rects[4].width > rects[0].width * 1.9);
    } else {
      assert(rects.every(box => box.x === rects[0].x));
      assert(rects.every((box, index) => index === 0 || box.y >= rects[index - 1].y + rects[index - 1].height));
    }
    const readable = await cards.locator("h3, p").evaluateAll(elements => elements.every(element => {
      const box = element.getBoundingClientRect();
      const card = element.closest("article")!.getBoundingClientRect();
      return box.left >= card.left && box.right <= card.right && box.bottom <= card.bottom && Number.parseFloat(getComputedStyle(element).fontSize) >= 12;
    }));
    assert(readable, `${width}px card copy must fit`);
    await section.screenshot({ path: resolve(directory, `bento-${width}.png`), style: 'header:has(a[aria-label="FLINCH home"]), nextjs-portal { visibility: hidden; }' });
    layouts.push({ width, cards: rects });
  }

  const motion = await checkBentoMotion(page, directory);
  const containment = await checkBentoContainment(page, directory);
  const contrast = await section.locator('h2, h2 span, h3, p, button:not(:disabled), [data-stake-asset] > span, [data-bento-card="custody"] :is(strong, small, span:not(:has(*))), [data-bento-card="rollup"] :is(strong, small, span:not(:has(*)))').evaluateAll(elements => {
    const context = document.createElement("canvas").getContext("2d")!;
    const channels = (color: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data];
    };
    const luminance = (rgb: number[]) => {
      const linear = rgb.slice(0, 3).map(value => value / 255 <= .04045 ? value / 255 / 12.92 : ((value / 255 + .055) / 1.055) ** 2.4);
      return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
    };
    return elements.filter(element => element.textContent?.trim()).map(element => {
      let parent: Element | null = element;
      let background = [255, 255, 255, 255];
      while (parent) {
        background = channels(getComputedStyle(parent).backgroundColor);
        if (background[3] === 255) break;
        parent = parent.parentElement;
      }
      const foreground = luminance(channels(getComputedStyle(element).color));
      const base = luminance(background);
      return { text: element.textContent, ratio: Number(((Math.max(foreground, base) + .05) / (Math.min(foreground, base) + .05)).toFixed(2)) };
    });
  });
  assert(contrast.every(sample => sample.ratio >= 4.5), JSON.stringify(contrast));
  const staticPage = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 1280, height: 1100 } });
  await staticPage.goto(url);
  await expect(staticPage.locator("#onchain h3")).toHaveCount(5);
  await expect(staticPage.locator('[data-bento-card="custody"]')).toHaveAttribute("data-phase", "3");
  await expect(staticPage.locator('[data-bento-card="settlement"]')).toHaveAttribute("data-phase", "2");
  await expect(staticPage.locator('#onchain [data-running="true"]')).toHaveCount(0);
  await staticPage.locator("#onchain").screenshot({ path: resolve(directory, "bento-no-js.png"), style: 'header:has(a[aria-label="FLINCH home"]) { visibility: hidden; }' });
  await staticPage.close();
  assert.equal(errors.length, 0, errors.join("\n"));
  const external = requests.filter(request => /^https?:/.test(request) && new URL(request).origin !== new URL(url).origin);
  assert.deepEqual(external, [], "Landing must not fetch external market, wallet or RPC data");
  const result = { status: "passed", url, layouts, motion, containment, contrast, pageErrors: errors, externalRequests: external,
    noJavaScript: true, officialAssets: true, scope: "Landing illustrations only; no wallet or chain actions" };
  writeFileSync(resolve(directory, "result.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ directory, status: result.status, motion }, null, 2));
} catch (error) {
  await page.screenshot({ path: resolve(directory, "failure.png"), fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
