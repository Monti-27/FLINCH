import assert from "node:assert/strict";
import { resolve } from "node:path";
import { expect } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";

async function snapshot(page: Page) {
  return page.evaluate(() => ({ ...window.__flinchShaderProbe }));
}

async function sample(page: Page) {
  await page.evaluate(() => { window.__flinchShaderProbe.sample = true; });
  await page.waitForFunction(() => !window.__flinchShaderProbe.sample);
  return snapshot(page);
}

async function expectFrozen(page: Page) {
  await page.waitForTimeout(150);
  const first = await snapshot(page);
  await page.waitForTimeout(250);
  const second = await snapshot(page);
  assert.equal(second.draws, first.draws, "Paused shader must stop drawing");
  assert.equal(second.time, first.time, "Paused shader must not advance time");
  return second;
}

export async function checkShader(page: Page, browser: Browser, url: string, directory: string) {
  await page.setViewportSize({ width: 1280, height: 900 });
  const footer = page.getByRole("contentinfo", { name: "About FLINCH" });
  const canvas = footer.locator(".footer-shader");
  await footer.scrollIntoViewIfNeeded();
  await expect(canvas).toHaveAttribute("data-state", "ready");
  const first = await sample(page);
  await page.waitForTimeout(250);
  const second = await sample(page);
  assert(second.colors > 16, "Shader framebuffer must contain real rendered variation");
  assert.notEqual(first.signature, second.signature, "Waves must visibly change between frames");
  assert(second.time < first.time, "Supplied negative time scale must be preserved");
  const pause = footer.getByRole("button", { name: "Pause background animation", exact: true });
  await pause.focus();
  await page.keyboard.press("Space");
  await expect(footer.getByRole("button", { name: "Resume background animation", exact: true })).toBeFocused();
  await expectFrozen(page);
  await page.setViewportSize({ width: 768, height: 900 });
  await expect(canvas).toHaveAttribute("data-state", "ready");
  await expectFrozen(page);
  const pixels = await canvas.evaluate(element => {
    const surface = element as HTMLCanvasElement;
    return { width: surface.width, height: surface.height };
  });
  assert(pixels.width * pixels.height <= 2_000_000);
  await footer.getByRole("button", { name: "Resume background animation", exact: true }).click();
  const resumed = await sample(page);
  assert(resumed.draws > second.draws);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(footer.getByRole("button", { name: "Background motion disabled by system preference", exact: true })).toBeDisabled();
  await expectFrozen(page);
  await footer.screenshot({ path: resolve(directory, "footer-reduced-motion.png") });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await sample(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expectFrozen(page);
  await footer.scrollIntoViewIfNeeded();
  await sample(page);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expectFrozen(page);
  await page.evaluate(() => {
    Reflect.deleteProperty(document, "visibilityState");
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await sample(page);
  await canvas.evaluate(element => {
    window.__flinchLostContext = (element as HTMLCanvasElement).getContext("webgl")?.getExtension("WEBGL_lose_context");
    if (!window.__flinchLostContext) throw new Error("Context-loss extension is unavailable in this browser");
    window.__flinchLostContext.loseContext();
  });
  await expect(canvas).toHaveAttribute("data-state", "context-lost");
  await expect(canvas).toHaveCSS("visibility", "hidden");
  await expect(footer.locator(".footer-lockup")).toBeVisible();
  await expectFrozen(page);
  await page.evaluate(() => window.__flinchLostContext?.restoreContext());
  await expect(canvas).toHaveAttribute("data-state", "ready");
  const restored = await sample(page);
  assert(restored.colors > 16);

  const fallback = await browser.newPage({ viewport: { width: 375, height: 900 }, reducedMotion: "reduce" });
  const fallbackErrors: string[] = [];
  fallback.on("pageerror", error => fallbackErrors.push(error.message));
  try {
    await fallback.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, ...args: Parameters<typeof original>) {
        if (this.matches(".footer-shader")) return null;
        return original.apply(this, args);
      } as typeof original;
    });
    await fallback.goto(url);
    const fallbackFooter = fallback.getByRole("contentinfo", { name: "About FLINCH" });
    await fallbackFooter.scrollIntoViewIfNeeded();
    await expect(fallbackFooter.locator(".footer-shader")).toHaveAttribute("data-state", "unavailable");
    await expect(fallbackFooter.locator(".footer-lockup")).toBeVisible();
    await fallbackFooter.screenshot({ path: resolve(directory, "footer-no-webgl.png") });
    await fallbackFooter.getByRole("button", { name: "Read the rules", exact: true }).click();
    await expect(fallback.getByRole("dialog", { name: "How to play" })).toBeVisible();
    assert.deepEqual(fallbackErrors, []);
  } finally { await fallback.close(); }
  await page.evaluate(() => window.scrollTo(0, 0));
  return { webglFrameVariation: true, manualPause: true, reducedMotion: true, offscreenPause: true, simulatedVisibilityPause: true, contextRestored: true, pixelBudget: true, noWebglFallback: true };
}
