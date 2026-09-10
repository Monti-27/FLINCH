import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";
import { BRAND_PATHS, BRAND_VIEW_BOX } from "../src/components/brand/geometry.ts";

const origin = process.env.FLINCH_LANDING_URL ?? "http://127.0.0.1:3411";
assert.equal(new URL(origin).hostname, "127.0.0.1");
const directory = resolve(`artifacts/runs/brand-colors-${Date.now()}`);
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.FLINCH_BROWSER_EXECUTABLE });
const page = await browser.newPage({ reducedMotion: "reduce" });
const errors: string[] = [];
const surfaces = [];
page.on("pageerror", error => errors.push(error.message));

try {
  for (const route of ["/", "/play", "/missing-brand-check"]) {
    await page.goto(new URL(route, origin).href);
    await page.evaluate(() => document.fonts.ready);
    if (route === "/play") await expect(page.getByRole("button", { name: "Connect wallet", exact: true })).toBeVisible();
    for (const width of [320, 375, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
      const marks = page.locator(".brand-mark");
      assert(await marks.count() > 0);
      const home = page.getByRole(route === "/play" ? "button" : "link", { name: "FLINCH home", exact: true });
      const homeBounds = await home.boundingBox();
      assert(homeBounds && homeBounds.width >= 44 && homeBounds.height >= 44);
      const restingColor = await marks.first().evaluate(element => getComputedStyle(element).color);
      await home.hover();
      assert.equal(await marks.first().evaluate(element => getComputedStyle(element).color), restingColor);
      for (const mark of await marks.all()) {
        await expect(mark).toHaveAttribute("viewBox", BRAND_VIEW_BOX);
        assert.deepEqual(await mark.locator("path").evaluateAll(paths => paths.map(path => path.getAttribute("d"))), [...BRAND_PATHS]);
        const result = await mark.evaluate(element => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          const dark = element.closest('[data-theme="dark"]') !== null || location.pathname === "/play";
          const color = style.color.match(/[\d.]+/g)!.slice(0, 3).map(Number);
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = 1;
          const context = canvas.getContext("2d")!;
          let background: number[] | undefined;
          for (let parent = element.parentElement; parent; parent = parent.parentElement) {
            context.clearRect(0, 0, 1, 1);
            context.fillStyle = getComputedStyle(parent).backgroundColor;
            context.fillRect(0, 0, 1, 1);
            const rgba = [...context.getImageData(0, 0, 1, 1).data];
            if (rgba[3] === 255) { background = rgba.slice(0, 3); break; }
          }
          if (!background) throw new Error("No opaque logo surface found");
          const luminance = (values: number[]) => values.map(value => value / 255 <= .04045 ? value / 255 / 12.92 : ((value / 255 + .055) / 1.055) ** 2.4)
            .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
          const [a, b] = [luminance(color), luminance(background)].sort((first, second) => second - first);
          return { color: style.color, background, dark, contrast: (a + .05) / (b + .05),
            aspect: rect.width / rect.height, contained: rect.x >= 0 && rect.right <= innerWidth };
        });
        assert.equal(result.color, result.dark ? "rgb(229, 229, 230)" : "rgb(16, 16, 19)");
        assert(result.contrast >= 3 && Math.abs(result.aspect - 224 / 264) < .01 && result.contained);
        surfaces.push({ route, width, ...result });
      }
      await page.screenshot({ path: resolve(directory, `${route === "/" ? "landing" : route === "/play" ? "arena" : "not-found"}-${width}.png`) });
    }
    if (route !== "/missing-brand-check") {
      await page.locator(".app-footer").scrollIntoViewIfNeeded();
      await page.screenshot({ path: resolve(directory, `${route === "/" ? "light" : "dark"}-footer.png`) });
      const footerMark = page.locator(".app-footer .brand-mark");
      const color = await footerMark.evaluate(element => getComputedStyle(element).color);
      await page.emulateMedia({ reducedMotion: "no-preference" });
      assert.equal(await footerMark.evaluate(element => getComputedStyle(element).color), color);
      await page.emulateMedia({ reducedMotion: "reduce" });
    }
  }
  const landing = await page.request.get(new URL("/", origin).href);
  const arena = await page.request.get(new URL("/play", origin).href);
  assert((await landing.text()).includes('class="brand-mark"'));
  assert((await arena.text()).includes('data-arena-loading=""'));
  assert.deepEqual(errors, []);
  writeFileSync(resolve(directory, "result.json"), JSON.stringify({ complete: true, surfaces, canonicalGeometry: true, serverRenderedMarks: true, pageErrors: errors }, null, 2));
  console.log(`Brand color checks passed: ${directory}`);
} catch (error) {
  await page.screenshot({ path: resolve(directory, "failure.png"), fullPage: true });
  console.error(`Brand color evidence: ${directory}`);
  throw error;
} finally { await browser.close(); }
