import assert from "node:assert/strict";
import { resolve } from "node:path";
import { expect } from "@playwright/test";
import type { Browser } from "@playwright/test";

export async function checkPixelGarden(browser: Browser, url: string, directory: string) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  const errors: string[] = [];
  const external: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    if (new URL(request.url()).origin !== new URL(url).origin) external.push(request.url());
  });
  try {
    const response = await page.goto(`${url}/missing-flinch-page`);
    assert.equal(response?.status(), 404);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("This page wandered off.");
    await expect(page.locator("footer")).toHaveCount(0);
    const garden = page.getByRole("button", { name: "Plant a flower", exact: true });
    const clear = page.getByRole("button", { name: "Clear garden", exact: true });
    await expect(clear).toBeDisabled();
    for (const width of [320, 375, 768, 1280, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const box = await garden.boundingBox();
      assert(box);
      for (const [x, y] of [[.2, .68], [.35, .76], [.65, .6], [.8, .82]]) {
        await garden.click({ position: { x: box.width * x, y: box.height * y } });
      }
      await expect(page.locator("[data-flower]")).toHaveCount(4);
      await expect(garden).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
      assert(await page.locator("[data-flower] svg").evaluateAll(elements => elements.every(element => getComputedStyle(element).animationName === "none")));
      await page.screenshot({ path: resolve(directory, `garden-${width}.png`) });
      await clear.click();
      await expect(page.locator("[data-flower]")).toHaveCount(0);
    }
    await garden.focus();
    await page.keyboard.press("Space");
    await expect(page.locator("[data-flower]")).toHaveCount(1);
    await expect(garden).toHaveCSS("outline-style", "dashed");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status")).toHaveText("2 flowers planted.");
    for (let index = 0; index < 52; index++) await page.keyboard.press("Enter");
    await expect(page.locator("[data-flower]")).toHaveCount(48);
    await page.keyboard.press("Tab");
    await expect(clear).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-flower]")).toHaveCount(0);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await garden.click({ position: { x: 180, y: 280 } });
    await expect(page.locator("[data-flower] svg")).toHaveCSS("animation-duration", "0.48s");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator("[data-flower] svg")).toHaveCSS("animation-name", "none");
    assert.deepEqual(external, []);
    await page.getByRole("link", { name: "Back home", exact: true }).click();
    await expect(page).toHaveURL(`${url}/`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Four players.Who flinches first?");
    const touch = await browser.newPage({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true, reducedMotion: "reduce" });
    try {
      await touch.goto(`${url}/missing-flinch-page`);
      await touch.getByRole("button", { name: "Plant a flower" }).tap();
      await expect(touch.locator("[data-flower]")).toHaveCount(1);
      await touch.getByRole("button", { name: "Clear garden" }).tap();
      await expect(touch.locator("[data-flower]")).toHaveCount(0);
    } finally { await touch.close(); }
    const staticPage = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 375, height: 812 } });
    try {
      const staticResponse = await staticPage.goto(`${url}/missing-flinch-page`);
      assert.equal(staticResponse?.status(), 404);
      await expect(staticPage.locator("noscript p")).toHaveText("Flower planting needs JavaScript. You can still head back home.");
      await expect(staticPage.locator("noscript p")).toBeVisible();
      await staticPage.getByRole("link", { name: "Back home", exact: true }).click();
      await expect(staticPage.getByRole("heading", { level: 1 })).toBeVisible();
    } finally { await staticPage.close(); }
    assert.deepEqual(errors, []);
    return { http404: true, noindex: true, layouts: [320, 375, 768, 1280, 1920], clickAndTouch: true, keyboard: true,
      boundedFlowers: 48, clear: true, liveReducedMotion: true, noJavaScriptRecovery: true, homeNavigation: true, noExternalTraffic: true, pageErrors: errors };
  } finally { await page.close(); }
}
