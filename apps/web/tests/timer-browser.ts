import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, expect } from "@playwright/test";
import { checkTimerSync } from "./timer-sync-browser.ts";

const require = createRequire(import.meta.url);
const vitePath = require.resolve("vite", { paths: [dirname(require.resolve("vitest"))] });
const { createServer } = await import(pathToFileURL(vitePath).href);
const directory = resolve(`artifacts/runs/timer-${Date.now()}`);
mkdirSync(directory, { recursive: true });
const server = await createServer({ configFile: false, root: resolve("apps/web"), server: { host: "127.0.0.1", port: 0, watch: { ignored: ["**/.next/**"] } },
  esbuild: { jsx: "automatic" }, css: { postcss: { plugins: [] } },
  plugins: [{ name: "timer-fixture", configureServer(instance: typeof server) {
    instance.middlewares.use("/timer.html", async (_request: unknown, response: { setHeader: (key: string, value: string) => void; end: (body: string) => void }) => {
      const html = await instance.transformIndexHtml("/timer.html", `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Timer test</title>
        <style>@font-face{font-family:TimerDisplay;src:url(/node_modules/@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2)}
        @font-face{font-family:TimerSans;src:url(/node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2)}
        :root{--font-space-grotesk:TimerDisplay;--font-manrope:TimerSans}*{box-sizing:border-box}body{margin:0;background:#101013;color:#f2f2f3;font-family:TimerSans,sans-serif}
        main{padding:24px}section{display:flex;justify-content:space-between;align-items:center;gap:12px;width:100%;max-width:1040px;margin:64px auto}
        h1{font:500 clamp(28px,4vw,48px)/1.1 TimerDisplay;letter-spacing:-.055em}nav{display:flex;flex-wrap:wrap;gap:16px;margin-top:100px}button,input{min-height:44px}p{font-size:12px;color:#b0b0b5}
        @media(max-width:600px){main{padding:20px}h1{font-size:30px}}</style></head><body><div id="root"></div><script type="module" src="/tests/timer-browser-fixture.tsx"></script></body></html>`);
      response.setHeader("Content-Type", "text/html");
      response.end(html);
    });
  } }] });
await server.listen();
const address = server.httpServer.address();
const browser = await chromium.launch({ executablePath: process.env.FLINCH_BROWSER_EXECUTABLE });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: "no-preference" });
const errors: string[] = [];
page.on("pageerror", error => errors.push(error.message));
page.setDefaultTimeout(15_000);
const dial = page.getByRole("timer");
const rays = dial.locator("svg g line:last-child");
const fills = () => rays.evaluateAll(elements => elements.map(element => Number(getComputedStyle(element).opacity)));
const setTime = async (milliseconds: number) => { await page.getByLabel("Milliseconds").fill(String(milliseconds)); };

try {
  await page.goto(`http://127.0.0.1:${address.port}/timer.html`);
  await expect(dial).toHaveAttribute("data-reduced-motion", "false");
  await page.evaluate(() => document.fonts.ready);
  await expect(rays).toHaveCount(72);
  assert((await fills()).every(value => value === 1));
  const geometry = [];
  for (const width of [320, 375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px overflow`);
    const rect = await dial.boundingBox();
    const title = await page.getByRole("heading").boundingBox();
    assert(rect && title && title.x + title.width <= rect.x, `${width}px timer overlaps title`);
    const centered = await dial.evaluate(element => {
      const ring = element.querySelector("svg")!.getBoundingClientRect();
      const value = element.querySelector("strong")!.getBoundingClientRect();
      const centerX = ring.x + ring.width / 2;
      const centerY = ring.y + ring.height / 2;
      return Math.abs(value.x + value.width / 2 - centerX) < 1 && Math.abs(value.y + value.height / 2 - centerY) < 1
        && value.width < ring.width * .58 && getComputedStyle(element).borderLeftWidth === "0px";
    });
    assert(centered, `${width}px number must stay inside the ring without a left divider`);
    geometry.push({ width, timer: rect });
    await page.getByRole("region", { name: "Timer fixture" }).screenshot({ path: resolve(directory, `timer-${width}.png`) });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("button", { name: "Start", exact: true }).click();
  const motion = await dial.evaluate(element => new Promise<{ digitFrames: number; distinctFill: number; opposedBarFrames: number; distinctShape: number; shift: number; seconds: string[] }>(done => {
    const start = performance.now();
    const initial = element.getBoundingClientRect();
    let digitFrames = 0;
    let shift = 0;
    let opposedBarFrames = 0;
    let previous: number[] = [];
    const fill = new Set<string>();
    const shape = new Set<string>();
    const seconds = new Set<string>();
    const sample = () => {
      const box = element.getBoundingClientRect();
      shift = Math.max(shift, Math.abs(box.x - initial.x), Math.abs(box.width - initial.width));
      const glyphs = element.querySelectorAll('[class*="glyph"]');
      if ([...glyphs].some(glyph => Math.abs(new DOMMatrix(getComputedStyle(glyph).transform).m42) > .1)) digitFrames++;
      const rays = [...element.querySelectorAll("svg g line:last-child")];
      fill.add(rays.map(ray => getComputedStyle(ray).opacity).join(","));
      const ends = rays.map(ray => Number(ray.getAttribute("y2")));
      const deltas = ends.map((value, index) => value - (previous[index] ?? value));
      if (deltas.some(value => value > .0001) && deltas.some(value => value < -.0001)) opposedBarFrames++;
      shape.add(ends.map(value => value.toFixed(3)).join(","));
      previous = ends;
      seconds.add(element.querySelector("[data-seconds]")!.getAttribute("data-seconds")!);
      if (performance.now() - start < 2600) requestAnimationFrame(sample);
      else done({ digitFrames, distinctFill: fill.size, opposedBarFrames, distinctShape: shape.size, shift, seconds: [...seconds] });
    };
    requestAnimationFrame(sample);
  }));
  assert(motion.digitFrames > 8 && motion.distinctFill > 12, "Digits and rays must interpolate");
  assert(motion.opposedBarFrames > 8 && motion.distinctShape > 12, "Individual bars must extend and retract, not just fade");
  assert(motion.shift < .5, "Timer must not shift during digit transitions");
  assert(motion.seconds.includes("89") && motion.seconds.includes("88"));
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const colors: Record<string, string> = {};
  for (const value of [90_000, 60_000, 45_000, 10_000, 0]) {
    await setTime(value);
    await expect(dial).toHaveAttribute("data-remaining-ms", String(value));
    await expect.poll(async () => (await fills()).reduce((sum, value) => sum + value, 0)).toBeCloseTo(value / 90_000 * 72, 3);
    colors[value] = await dial.locator("svg").evaluate(element => getComputedStyle(element).color);
    await expect(dial.locator('[class*="glyph"]')).toHaveCount(2);
    await dial.screenshot({ path: resolve(directory, `time-${value}.png`) });
  }
  assert.notEqual(colors[90_000], colors[60_000]);
  assert.notEqual(colors[60_000], colors[10_000]);
  await expect(dial).not.toHaveAttribute("data-state", "ended");
  await setTime(20_000);
  await page.getByRole("button", { name: "Toggle stale" }).click();
  await expect(dial).toHaveAttribute("aria-label", "Stale estimate, 20 seconds");
  await expect(dial).toHaveAttribute("data-state", "stale");
  await page.getByRole("button", { name: "Toggle stale" }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(dial).toHaveAttribute("data-reduced-motion", "true");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(dial.locator("[data-seconds]")).toHaveAttribute("data-seconds", "19");
  assert(await dial.locator('[class*="glyph"]').evaluateAll(elements => elements.every(element => getComputedStyle(element).transform === "none")));
  await page.getByRole("button", { name: "End", exact: true }).click();
  await expect(dial).toHaveAttribute("data-state", "ended");
  await expect(dial).toHaveAttribute("aria-label", "Round ended");
  await expect.poll(async () => (await fills()).every(value => value === 0)).toBe(true);
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect.poll(async () => (await fills()).every(value => value === 1)).toBe(true);
  await page.clock.install({ time: new Date("2026-09-11T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-09-11T00:01:00Z"));
  await page.getByRole("button", { name: "Start", exact: true }).click();
  for (let seconds = 89; seconds >= 0; seconds--) {
    await page.clock.fastForward(1000);
    await expect(dial.locator("[data-seconds]")).toHaveAttribute("data-seconds", String(seconds));
  }
  await page.clock.fastForward(5000);
  await expect(dial.locator("[data-seconds]")).toHaveAttribute("data-seconds", "0");
  await expect(dial).not.toHaveAttribute("data-state", "ended");
  const syncPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  syncPage.on("pageerror", error => errors.push(error.message));
  const cpu = await syncPage.context().newCDPSession(syncPage);
  await cpu.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const synchronization = await checkTimerSync(syncPage, `http://127.0.0.1:${address.port}/timer.html`);
  await syncPage.screenshot({ path: resolve(directory, "synchronized.png") });
  await syncPage.close();
  assert.deepEqual(errors, []);
  writeFileSync(resolve(directory, "result.json"), JSON.stringify({ passed: true, geometry, motion, colors, reducedMotion: true, fullCountdown: true, states: true,
    synchronization, cpuThrottle: 4, scope: "Isolated real component with controlled and irregular observations, no transactions", errors }, null, 2));
  console.log(`Timer checks passed: ${directory}`);
} catch (error) {
  await page.screenshot({ path: resolve(directory, "failure.png"), fullPage: true });
  console.error(`Timer evidence: ${directory}`);
  throw error;
} finally {
  await browser.close();
  await server.close();
}
