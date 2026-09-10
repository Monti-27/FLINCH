import assert from "node:assert/strict";
import { resolve } from "node:path";
import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

export async function checkComponents(page: Page, directory: string) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("button", { name: "New round", exact: true }).click();
  await expect(page.getByRole("group", { name: "Room entry mode" })).toHaveAttribute("data-appearance", "tabs");
  const presets = page.getByRole("group", { name: "Stake presets" });
  await expect(presets).toHaveAttribute("data-appearance", "keys");
  await presets.getByRole("button", { name: "0.005 SOL", exact: true }).focus();
  await page.keyboard.press("Enter");
  const input = page.getByLabel("Stake per player, in SOL");
  await expect(input).toHaveValue("0.005");
  assert(!new URL(page.url()).searchParams.has("room"), "A preset must not create or join a room");
  await input.fill("0.001000001");
  await expect(input).toHaveValue("0.001000001");
  await expect(input).toHaveAttribute("type", "text");
  await expect(page.locator(".token-input-value")).toHaveCSS("outline-style", "solid");
  const surface = await page.locator(".token-input").evaluate(element => {
    const style = getComputedStyle(element);
    return { border: style.borderBottomStyle, depth: style.boxShadow, background: style.backgroundColor };
  });
  assert.equal(surface.border, "solid");
  assert.equal(surface.depth, "none");
  const interval = page.getByRole("group", { name: "Candle interval" });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await interval.getByRole("button", { name: "1m", exact: true }).click();
  const controlsBefore = await interval.boundingBox();
  await interval.getByRole("button", { name: "5m", exact: true }).click();
  await expect.poll(() => interval.evaluate(element => {
    const style = getComputedStyle(element, "::before");
    const index = [...element.querySelectorAll("button")].findIndex(button => button.getAttribute("aria-pressed") === "true");
    return Math.round(new DOMMatrixReadOnly(style.transform).m41) === Math.round(parseFloat(style.width) * index);
  })).toBe(true);
  assert.deepEqual(await interval.boundingBox(), controlsBefore, "Selector motion must not move its buttons");
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(await interval.evaluate(element => getComputedStyle(element, "::before").transitionDuration), "0s");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  for (const width of [320, 375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    assert(await input.evaluate(element => {
      if (!(element instanceof HTMLInputElement)) return false;
      const style = getComputedStyle(element);
      const context = document.createElement("canvas").getContext("2d")!;
      context.font = style.font;
      const tracking = parseFloat(style.letterSpacing) || 0;
      return context.measureText(element.value).width + tracking * (element.value.length - 1) <= element.clientWidth;
    }), `A valid nine-decimal stake must be fully readable at ${width}`);
    for (const control of await page.locator(".entry-modes button, .stake-presets button, .create-action, .token-input-value input").all()) {
      const bounds = await control.boundingBox();
      assert(bounds && bounds.width >= 40 && bounds.height >= 40, `Room control too small at ${width}`);
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Component overflow at ${width}`);
    await page.locator(".lobby-section").screenshot({ path: resolve(directory, `entry-${width}.png`) });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await presets.getByRole("button", { name: "0.001 SOL", exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  return { selectorVariants: true, stableSelectorMotion: true, reducedMotion: true, keyboardPresets: true, exactInput: true, inputFocus: true, amountSurface: surface, mobileTargets: true };
}
