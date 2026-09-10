import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, expect, type Page } from "@playwright/test";

const url = process.env.FLINCH_THEME_URL ?? "http://127.0.0.1:3420";
assert.equal(new URL(url).hostname, "127.0.0.1");
const directory = resolve(`artifacts/runs/landing-theme-${Date.now()}`);
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.FLINCH_BROWSER_EXECUTABLE });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: "light", reducedMotion: "reduce" });
const page = await context.newPage();
const errors: string[] = [];
const requests: string[] = [];
page.on("pageerror", error => errors.push(error.message));
page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
page.on("request", request => requests.push(request.url()));
const root = page.locator("[data-landing-theme]");
const toggle = page.getByRole("switch", { name: "Dark mode" });
const theme = async (dark: boolean) => {
  if ((await toggle.getAttribute("aria-checked")) !== String(dark)) await toggle.click();
  await expect(root).toHaveAttribute("data-landing-theme", dark ? "dark" : "light");
  await expect(toggle).toHaveAttribute("aria-busy", "false");
  await expect(page.locator("footer")).toHaveAttribute("data-theme", dark ? "dark" : "light");
};
const geometry = () => page.locator('[data-hero-art] *, section[aria-labelledby="landing-title"], #onchain, [data-bento-card], #questions, footer').evaluateAll(elements =>
  elements.map(element => {
    const r = element.getBoundingClientRect();
    return [r.x, r.y + scrollY, r.width, r.height].map(value => Math.round(value * 100) / 100);
  }));

async function contrast(target: Page) {
  return target.locator("[data-landing-theme]").evaluate(element => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d")!;
    const rgb = (color: string) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      return Array.from(ctx.getImageData(0, 0, 1, 1).data);
    };
    const luminance = (color: number[]) => color.slice(0, 3).map(value => value / 255)
      .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
      .reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
    const results: { text: string; ratio: number; gradient: boolean }[] = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const parent = node.parentElement!;
      const text = node.textContent?.trim();
      if (!text || parent.closest("script,svg,style") || !parent.getClientRects().length) continue;
      const ancestors: Element[] = [];
      let visible = true, gradient = false;
      for (let current: Element | null = parent; current; current = current.parentElement) {
        const style = getComputedStyle(current);
        if (Number(style.opacity) < .99 || style.visibility !== "visible" || style.display === "none") visible = false;
        ancestors.unshift(current);
      }
      if (!visible) continue;
      let background = [255, 255, 255];
      for (const ancestor of ancestors) {
        const style = getComputedStyle(ancestor);
        const color = rgb(style.backgroundColor);
        if (color[3] === 255) gradient = false;
        if (style.backgroundImage !== "none") gradient = true;
        background = background.map((v, i) => color[i] * color[3] / 255 + v * (1 - color[3] / 255));
      }
      const fg = luminance(rgb(getComputedStyle(parent).color)), bg = luminance(background);
      if (text === "+" && parent.closest('[data-bento-card="holders"]')) gradient = true;
      results.push({ text, ratio: (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05), gradient });
    }
    return results;
  });
}

try {
  await page.goto(url);
  await expect(toggle).toBeEnabled();
  await page.evaluate(() => document.fonts.ready);
  const artwork = await page.locator("[data-hero-art] svg").evaluate(element => element.outerHTML);
  const layouts = [];
  for (const width of [320, 375, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await theme(false);
    const light = await geometry();
    await page.screenshot({ path: resolve(directory, `light-${width}.png`), fullPage: true });
    await theme(true);
    assert.deepEqual(await geometry(), light, `${width}px geometry changed across themes`);
    assert.equal(await page.locator("[data-hero-art] svg").evaluate(element => element.outerHTML), artwork);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const bounds = await toggle.boundingBox();
    assert(bounds && bounds.width >= 44 && bounds.height >= 44);
    await page.screenshot({ path: resolve(directory, `dark-${width}.png`), fullPage: true });
    const text = await contrast(page);
    const low = text.filter(value => value.ratio < 4.5 && !value.gradient);
    assert.deepEqual(low, [], `${width}px text contrast`);
    layouts.push({ width, geometryPreserved: true, text });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await toggle.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Space");
  await expect(root).toHaveAttribute("data-landing-theme", "light");
  await page.keyboard.press("Enter");
  await expect(root).toHaveAttribute("data-landing-theme", "dark");
  await page.reload();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  const second = await context.newPage();
  await second.goto(url);
  await theme(false);
  await expect(second.locator("[data-landing-theme]")).toHaveAttribute("data-landing-theme", "light");
  await theme(true);
  await second.close();
  await page.emulateMedia({ colorScheme: "light" });
  await expect(root).toHaveAttribute("data-landing-theme", "dark");
  await page.locator("#questions").scrollIntoViewIfNeeded();
  for (const summary of await page.locator("[data-faq] summary").all()) {
    await summary.click();
    await expect(summary.locator("..")).toHaveAttribute("open", "");
    await summary.click();
  }
  await page.getByRole("button", { name: "Read the rules", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Read the rules", exact: true })).toBeFocused();
  await page.locator("footer summary").click();
  await expect(page.locator("footer details")).toHaveAttribute("open", "");
  const hand = page.locator(".footer-hand-current").first();
  await expect(hand).toHaveAttribute("data-state", "ready");
  const handState = () => hand.evaluate(element => {
    const gl = (element as HTMLCanvasElement).getContext("webgl")!;
    const program = gl.getParameter(gl.CURRENT_PROGRAM);
    const ink = gl.getUniformLocation(program, "u_ink"), time = gl.getUniformLocation(program, "u_scene");
    if (!ink || !time) throw new Error("Hand shader uniforms are unavailable");
    const color = gl.getUniform(program, ink);
    const scene = gl.getUniform(program, time);
    return { color: Array.from(color as Float32Array).map(value => Math.round(value * 255)), time: scene[2] };
  });
  const stationary = await handState();
  assert.deepEqual(stationary.color, [189, 199, 213]);
  for (const [expected, color] of [["light", [63, 70, 87]], ["dark", [189, 199, 213]]] as const) {
    const beforeScroll = await page.evaluate(() => scrollY);
    const target = (await toggle.boundingBox())!;
    await page.mouse.click(target.x + target.width / 2, target.y + target.height / 2);
    await expect(root).toHaveAttribute("data-landing-theme", expected);
    await expect.poll(async () => (await handState()).color).toEqual([...color]);
    assert.equal((await handState()).time, stationary.time, "Theme changes reset the hand animation clock");
    assert.equal(await page.evaluate(() => scrollY), beforeScroll, "Theme changes moved the reading position");
    await expect(page.locator("footer details")).toHaveAttribute("open", "");
  }
  await page.screenshot({ path: resolve(directory, "dark-footer.png") });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await toggle.click();
  await expect(page.locator("[data-theme-sweep]")).toBeVisible();
  await page.screenshot({ path: resolve(directory, "glimm-sweep.png") });
  await expect(toggle).toHaveAttribute("aria-busy", "false");
  await expect(page.locator("[data-theme-sweep]")).toBeHidden();
  await toggle.click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(toggle).toHaveAttribute("aria-busy", "false");
  await expect(root).toHaveAttribute("data-landing-theme", "dark");
  await expect(page.locator("[data-theme-sweep]")).toBeHidden();
  const fallback = await browser.newContext({ colorScheme: "dark", reducedMotion: "no-preference" });
  await fallback.addInitScript(() => {
    Object.defineProperty(window, "localStorage", { get() { throw new Error("Storage unavailable"); } });
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      return type.includes("webgl") ? null : Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
  });
  const noGpu = await fallback.newPage();
  await noGpu.goto(url);
  await expect(noGpu.locator("[data-landing-theme]")).toHaveAttribute("data-landing-theme", "dark");
  await noGpu.getByRole("switch", { name: "Dark mode" }).click();
  await expect(noGpu.locator("[data-landing-theme]")).toHaveAttribute("data-landing-theme", "light");
  await expect(noGpu.locator("[data-theme-sweep]")).toBeHidden();
  await fallback.close();
  const systemPage = await browser.newPage({ colorScheme: "dark", reducedMotion: "reduce" });
  await systemPage.goto(url);
  await expect(systemPage.locator("[data-landing-theme]")).toHaveAttribute("data-landing-theme", "dark");
  await systemPage.emulateMedia({ colorScheme: "light" });
  await expect(systemPage.locator("[data-landing-theme]")).toHaveAttribute("data-landing-theme", "light");
  await systemPage.close();
  const staticPage = await browser.newPage({ javaScriptEnabled: false });
  await staticPage.goto(url);
  await expect(staticPage.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(staticPage.getByRole("switch")).toBeDisabled();
  await staticPage.locator("[data-faq] summary").first().click();
  await expect(staticPage.locator("[data-faq] details[open] p")).toBeVisible();
  await staticPage.close();
  assert.deepEqual(errors, []);
  assert(requests.every(request => new URL(request).origin === new URL(url).origin), "Landing made an external request");
  assert(requests.every(request => !request.includes("/api/market")));
  await page.getByRole("link", { name: "Open app", exact: true }).click();
  await expect(page).toHaveURL(`${url}/play`);
  await expect(page.locator("[data-landing-theme]")).toHaveCount(0);
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(16, 16, 19)");
  await page.goBack();
  await expect(root).toHaveAttribute("data-landing-theme", "dark");
  writeFileSync(resolve(directory, "result.json"), JSON.stringify({ complete: true, layouts, keyboard: true, persistence: true,
    crossTab: true, systemTheme: true, reducedMotion: true, glimmSweep: true, noWebGlAndStorage: true, noJavaScript: true,
    faq: true, rules: true, footer: true, footerGpuPalette: true, scrollPreserved: true, arenaIsolation: true, noExternalRequests: true, errors }, null, 2));
  console.log(`Landing theme checks passed: ${directory}`);
} catch (error) {
  await page.screenshot({ path: resolve(directory, "failure.png"), fullPage: true });
  console.error(`Landing theme evidence: ${directory}`);
  throw error;
} finally { await browser.close(); }
