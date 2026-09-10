import assert from "node:assert/strict";
import { resolve } from "node:path";
import { expect } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";

async function sample(page: Page) {
  await page.evaluate(() => { window.__flinchShaderProbe.sample = true; });
  await page.waitForFunction(() => !window.__flinchShaderProbe.sample);
  return page.evaluate(() => ({ ...window.__flinchShaderProbe }));
}

async function expectFrozen(page: Page) {
  await page.waitForTimeout(150);
  const first = await page.evaluate(() => ({ ...window.__flinchShaderProbe }));
  await page.waitForTimeout(250);
  const second = await page.evaluate(() => ({ ...window.__flinchShaderProbe }));
  assert.equal(second.draws, first.draws, "Stopped hand shaders must stop drawing");
  assert.equal(second.time, first.time, "Stopped hand shaders must retain their time");
}

export async function checkFooterMotion(page: Page, browser: Browser, url: string, directory: string) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const footer = page.getByRole("contentinfo", { name: "About FLINCH" });
  const hands = footer.locator(".footer-hands");
  const canvases = footer.locator(".footer-hand-current");
  await footer.scrollIntoViewIfNeeded();
  await expect(hands).toHaveAttribute("data-running", "true");
  await expect(footer.locator(".footer-hand-left")).toHaveCSS("opacity", "1");
  for (const canvas of await canvases.all()) await expect(canvas).toHaveAttribute("data-state", "ready");
  const first = await sample(page);
  const firstImage = await footer.locator(".footer-hand-surface").first().screenshot();
  await page.waitForTimeout(350);
  const second = await sample(page);
  assert(second.colors > 16, "Hand shaders must render color variation");
  assert(second.time > first.time, "Hand currents must advance continuously");
  assert.notEqual(second.signature, first.signature);
  assert(!firstImage.equals(await footer.locator(".footer-hand-surface").first().screenshot()), "Masked characters must visibly change color");
  await expect(footer.getByRole("button", { name: /motion|animation/i })).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(hands).toHaveAttribute("data-running", "false");
  await expect(footer.locator(".footer-lockup")).toHaveCSS("animation-name", "none");
  await expectFrozen(page);
  await page.setViewportSize({ width: 768, height: 900 });
  await expectFrozen(page);
  await footer.screenshot({ path: resolve(directory, "footer-reduced-motion.png") });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await expect(hands).toHaveAttribute("data-running", "false");
  await expectFrozen(page);
  await footer.scrollIntoViewIfNeeded();
  await expect(hands).toHaveAttribute("data-running", "true");
  await sample(page);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(hands).toHaveAttribute("data-running", "false");
  await expectFrozen(page);
  await page.evaluate(() => {
    Reflect.deleteProperty(document, "hidden");
    Reflect.deleteProperty(document, "visibilityState");
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(hands).toHaveAttribute("data-running", "true");
  await sample(page);
  const canvas = canvases.first();
  await canvas.evaluate(element => {
    window.__flinchLostContext = (element as HTMLCanvasElement).getContext("webgl")?.getExtension("WEBGL_lose_context");
    if (!window.__flinchLostContext) throw new Error("Missing context-loss extension");
    window.__flinchLostContext.loseContext();
  });
  await expect(canvas).toHaveAttribute("data-state", "context-lost");
  await expect(canvas).toHaveCSS("opacity", "0");
  await expect(footer.locator(".footer-lockup")).toBeVisible();
  await page.evaluate(() => window.__flinchLostContext?.restoreContext());
  await expect(canvas).toHaveAttribute("data-state", "ready");
  assert((await sample(page)).colors > 16);
  const staticPage = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 375, height: 900 } });
  try {
    await staticPage.goto(new URL("/", url).href);
    const staticFooter = staticPage.locator(".app-footer");
    await staticFooter.scrollIntoViewIfNeeded();
    await expect(staticFooter.locator(".footer-lockup")).toBeVisible();
    await expect(staticFooter.locator(".footer-hand-left")).toHaveCSS("opacity", "1");
    await expect(staticFooter.locator(".footer-hands")).toHaveAttribute("data-running", "false");
    await staticFooter.screenshot({ path: resolve(directory, "footer-no-javascript.png") });
    await staticFooter.locator("summary").click();
    await expect(staticFooter.getByText(/No real-money wagering/)).toBeVisible();
  } finally { await staticPage.close(); }
  const fallback = await browser.newPage({ viewport: { width: 375, height: 900 } });
  try {
    await fallback.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, ...args: Parameters<typeof original>) {
        return this.matches(".footer-hand-current") ? null : original.apply(this, args);
      } as typeof original;
    });
    await fallback.goto(new URL("/", url).href);
    const fallbackFooter = fallback.locator(".app-footer");
    await fallbackFooter.scrollIntoViewIfNeeded();
    await expect(fallbackFooter.locator("canvas").first()).toHaveAttribute("data-state", "unavailable");
    await expect(fallbackFooter.locator(".footer-hand-left")).toHaveCSS("opacity", "1");
    await expect(fallbackFooter.locator(".footer-lockup")).toBeVisible();
    await fallbackFooter.screenshot({ path: resolve(directory, "footer-no-webgl.png") });
  } finally { await fallback.close(); }
  return { visibleColorFlow: true, colors: second.colors, reducedMotion: true, offscreenPause: true, simulatedHiddenPause: true, contextRestored: true, noWebglArtwork: true, noJavascriptArtwork: true };
}
