import assert from "node:assert/strict";
import { resolve } from "node:path";
import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { BRAND_PATHS, BRAND_VIEW_BOX } from "../src/components/brand/geometry.ts";

export async function checkBrand(page: Page, directory: string) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => document.fonts.ready);
  const layouts = [];
  for (const width of [320, 375, 480, 481, 600, 768, 1100, 1101, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => window.scrollTo(0, 0));
    const home = page.getByRole("button", { name: "FLINCH home", exact: true });
    await expect(home).toBeVisible();
    await expect(home.locator("svg")).toHaveAttribute("viewBox", BRAND_VIEW_BOX);
    await expect(home.locator("svg")).toHaveAttribute("aria-hidden", "true");
    assert.deepEqual(await home.locator("svg path").evaluateAll(paths => paths.map(path => path.getAttribute("d"))), [...BRAND_PATHS]);
    const geometry = await home.evaluate(element => {
      const rect = element.getBoundingClientRect();
      const mark = element.querySelector("svg")!.getBoundingClientRect();
      const header = element.closest("header")!.getBoundingClientRect();
      const target = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return { width: rect.width, height: rect.height, markWidth: mark.width, markHeight: mark.height,
        visible: rect.left >= 0 && rect.right <= innerWidth && mark.top >= header.top && mark.bottom <= header.bottom,
        hittable: target === element || element.contains(target), overflow: document.documentElement.scrollWidth > innerWidth };
    });
    assert(geometry.width >= 44 && geometry.height >= 44);
    assert(geometry.markHeight >= 32);
    assert(Math.abs(geometry.markWidth / geometry.markHeight - 224 / 264) < 0.01);
    assert(geometry.visible && geometry.hittable && !geometry.overflow, `Brand containment at ${width}: ${JSON.stringify(geometry)}`);
    if (width <= 480) await expect(home.locator(".brand-name")).toBeHidden();
    else await expect(home.locator(".brand-name")).toBeVisible();
    await page.locator(".app-header").screenshot({ path: resolve(directory, `brand-header-${width}.png`) });
    const footer = page.locator(".app-footer");
    const logo = footer.locator(".brand-logo");
    await footer.scrollIntoViewIfNeeded();
    await expect(logo).toBeVisible();
    const bounds = await logo.boundingBox();
    assert(bounds && bounds.x >= 16 && bounds.x + bounds.width <= width - 16);
    await expect(logo.locator("svg")).toHaveAttribute("viewBox", BRAND_VIEW_BOX);
    layouts.push({ viewportWidth: width, ...geometry, footerContained: true });
  }
  await page.setViewportSize({ width: 375, height: 900 });
  await page.evaluate(() => window.scrollTo(0, 0));
  const home = page.getByRole("button", { name: "FLINCH home", exact: true });
  await home.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(home).toBeFocused();
  await expect(home).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Create room", exact: true })).toBeVisible();

  const icons = await page.locator('link[rel="icon"], link[rel="apple-touch-icon"]').evaluateAll(links => links.map(link => ({
    rel: link.getAttribute("rel"), href: (link as HTMLLinkElement).href, type: link.getAttribute("type"),
  })));
  assert(icons.some(icon => icon.type === "image/svg+xml"));
  assert(icons.some(icon => icon.rel === "apple-touch-icon"));
  assert(icons.some(icon => new URL(icon.href).pathname === "/favicon.ico"));
  for (const icon of icons) {
    const response = await page.request.get(icon.href);
    assert.equal(response.status(), 200);
    assert((await response.body()).length > 0);
  }
  for (const file of ["flinch.svg", "flinch-light.svg"]) {
    const response = await page.request.get(new URL(`/brand/${file}`, page.url()).href);
    assert.equal(response.status(), 200);
    assert.match(response.headers()["content-type"], /image\/svg\+xml/);
    const source = await response.text();
    for (const d of BRAND_PATHS) assert(source.includes(d));
  }
  const initialResponse = await page.request.get(new URL("/play", page.url()).href);
  const initialHtml = await initialResponse.text();
  assert(initialHtml.includes('data-arena-loading=""'));
  assert(initialHtml.includes("Loading FLINCH"));
  for (const d of BRAND_PATHS) assert(initialHtml.includes(d));
  const browser = page.context().browser();
  assert(browser);
  const missing = await browser.newPage();
  const missingErrors: string[] = [];
  missing.on("pageerror", error => missingErrors.push(error.message));
  try {
    const response = await missing.goto(new URL("/missing-flinch-page", page.url()).href);
    assert.equal(response?.status(), 404);
    for (const width of [375, 768, 1280]) {
      await missing.setViewportSize({ width, height: 900 });
      await expect(missing.locator(".brand-logo")).toBeVisible();
      await expect(missing.locator(".brand-mark")).toHaveAttribute("viewBox", BRAND_VIEW_BOX);
      assert.equal(await missing.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await missing.screenshot({ path: resolve(directory, `brand-not-found-${width}.png`) });
    }
    await missing.getByRole("link", { name: "Back to arena", exact: true }).click();
    await expect(missing.getByRole("button", { name: "FLINCH home", exact: true })).toBeVisible();
    assert.deepEqual(missingErrors, []);
  } finally { await missing.close(); }
  await page.emulateMedia({ reducedMotion: "no-preference" });
  return { layouts, keyboardHome: true, iconMetadata: true, iconResponses: true, svgDownloads: true, serverRenderedLoading: true, notFoundRecovery: true };
}
