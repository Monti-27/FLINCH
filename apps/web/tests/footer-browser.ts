import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";
import { checkFooterMotion } from "./footer-motion-browser.ts";
import { installShaderProbe } from "./shader-probe.ts";

const url = process.env.FLINCH_FOOTER_URL ?? "http://127.0.0.1:3120";
assert.equal(new URL(url).hostname, "127.0.0.1");
const directory = resolve(`artifacts/runs/footer-browser-${Date.now()}`);
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.FLINCH_BROWSER_EXECUTABLE });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors: string[] = [];
page.on("pageerror", error => errors.push(error.message));
page.setDefaultTimeout(20_000);
await installShaderProbe(page);

try {
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  const footer = page.locator(".app-footer");
  await expect(footer.locator(".footer-hands")).toHaveAttribute("data-running", "false");
  await footer.scrollIntoViewIfNeeded();
  await expect(footer.locator(".footer-hands")).toHaveAttribute("data-running", "true");
  const entrance = await footer.locator(".footer-hand-left").evaluate(element => ({ opacity: Number(getComputedStyle(element).opacity), transform: getComputedStyle(element).transform }));
  assert(entrance.opacity < 1 && entrance.transform !== "none", "The entrance must visibly travel inward");
  await expect(footer.locator(".footer-lockup")).toHaveCSS("opacity", "1");
  await expect(footer.locator(".footer-hand-left")).toHaveCSS("opacity", "1");
  const layouts = [];
  for (const route of ["/", "/play"]) {
    await page.goto(new URL(route, url).href);
    await expect(footer).toHaveAttribute("data-theme", route === "/" ? "light" : "dark");
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const width of [320, 375, 768, 1280, 1720, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await footer.scrollIntoViewIfNeeded();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const lockup = await footer.locator(".footer-lockup").boundingBox();
      const bounds = await footer.boundingBox();
      assert(lockup && bounds);
      if (route === "/") {
        const main = await page.locator("#story").boundingBox();
        assert(main && Math.abs(main.x - bounds.x) < 1 && Math.abs(main.width - bounds.width) < 1, "Footer must align to the inner landing rails");
        assert(bounds.width < width && bounds.width <= 1070);
      } else assert(bounds.width === width && bounds.x === 0);
      assert(Math.abs(lockup.x + lockup.width / 2 - width / 2) < 1);
      assert(lockup.x > bounds.x && lockup.x + lockup.width < bounds.x + bounds.width);
      const left = await footer.locator(".footer-hand-left").boundingBox();
      const right = await footer.locator(".footer-hand-right").boundingBox();
      const identity = await footer.locator(".footer-identity").boundingBox();
      assert(left && right && identity);
      assert(left.x + left.width <= identity.x - 10 && right.x >= identity.x + identity.width + 10, "Characters must remain outside the identity's protected gap");
      assert(left.x + left.width <= lockup.x && right.x >= lockup.x + lockup.width);
      for (const control of await footer.locator("a, button, summary").all()) {
        const target = await control.boundingBox();
        assert(target && target.width >= 40 && target.height >= 40);
      }
      const background = await footer.evaluate(element => getComputedStyle(element).backgroundColor);
      const channels = background.match(/[\d.]+/g)!.slice(0, 3).map(value => Number(value) * (background.startsWith("color(") ? 255 : 1));
      assert(route === "/" ? channels.every(value => value > 240) : channels.every(value => value < 30));
      await footer.screenshot({ path: resolve(directory, `footer-${route === "/" ? "light" : "dark"}-${width}.png`) });
      if (route === "/" && width === 1280) await page.screenshot({ path: resolve(directory, "footer-landing-rails.png") });
      layouts.push({ route, width, background, centered: true, contained: true, noOverlap: true, noOverflow: true, touchTargets: true });
    }
  }
  await page.goto(url);
  const motion = await checkFooterMotion(page, browser, url, directory);
  await footer.scrollIntoViewIfNeeded();
  const rules = footer.getByRole("button", { name: "Read the rules", exact: true });
  await rules.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "How to play" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(rules).toBeFocused();
  await expect(rules).toHaveCSS("outline-style", "solid");
  await expect(footer.getByRole("link", { name: "Enter the arena", exact: true })).toHaveAttribute("href", "/play");
  await page.setViewportSize({ width: 1280, height: 900 });
  await footer.scrollIntoViewIfNeeded();
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const frameIntervals = await page.evaluate(() => new Promise<number[]>(resolve => {
    const times: number[] = [];
    const frame = (now: number) => {
      times.push(now);
      if (times.length < 180) requestAnimationFrame(frame);
      else resolve(times.slice(1).map((time, index) => time - times[index]));
    };
    requestAnimationFrame(frame);
  }));
  await session.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await session.detach();
  const sorted = [...frameIntervals].sort((a, b) => a - b);
  const performance = { cpuThrottle: 4, samples: sorted.length, p95Ms: sorted[Math.floor(sorted.length * 0.95)], maximumMs: sorted.at(-1) };
  assert.deepEqual(errors, []);
  writeFileSync(resolve(directory, "result.json"), JSON.stringify({ complete: true, entrance, layouts, motion, performance, keyboardRules: true, arenaLink: true, errors }, null, 2));
  console.log(`Footer checks passed: ${directory}`);
} catch (error) {
  await page.screenshot({ path: resolve(directory, "failure.png") });
  console.error(`Footer evidence: ${directory}`);
  throw error;
} finally { await browser.close(); }
