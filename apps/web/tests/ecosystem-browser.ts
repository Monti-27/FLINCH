import assert from "node:assert/strict";
import { resolve } from "node:path";
import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

export async function checkEcosystem(page: Page, directory: string) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("button", { name: "Protocol", exact: true }).click();
  for (const icon of ["magicblock.svg", "solana.svg", "raydium.png", "usdc.svg"]) {
    const response = await page.request.get(new URL(`/brand/ecosystem/${icon}`, page.url()).toString());
    assert.equal(response.status(), 200);
    assert.match(response.headers()["content-type"], icon.endsWith("svg") ? /image\/svg\+xml/ : /image\/png/);
  }
  for (const selector of [".navigation-resources", ".market-pair", ".token-unit", ".footer-links"]) {
    const icons = page.locator(`${selector} .ecosystem-icon`);
    assert.ok(await icons.count() > 0);
    for (const icon of await icons.all()) {
      await icon.scrollIntoViewIfNeeded();
      await expect(icon).toBeVisible();
      await expect.poll(() => icon.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      assert.equal(await icon.getAttribute("alt"), "");
      assert.ok((await icon.getAttribute("src"))?.startsWith("/brand/ecosystem/"));
      assert.equal(await icon.evaluate(element => getComputedStyle(element).objectFit), "contain");
      const box = await icon.boundingBox();
      assert.ok(box && box.width === box.height && box.width >= 16 && box.width <= 24);
    }
  }
  await page.locator(".app-header").scrollIntoViewIfNeeded();
  await page.screenshot({ path: resolve(directory, "ecosystem-menu.png") });
  await page.keyboard.press("Escape");
  return { localAssets: true, loaded: true, fixedBounds: true, decorativeAlt: true };
}
