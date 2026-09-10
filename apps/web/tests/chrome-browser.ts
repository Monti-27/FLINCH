import assert from "node:assert/strict";
import { resolve } from "node:path";
import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

export async function checkChrome(page: Page, directory: string) {
  await page.setViewportSize({ width: 1280, height: 900 });
  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  const game = navigation.getByRole("button", { name: "The game", exact: true });
  const chart = await page.locator(".market-canvas").boundingBox();
  await game.click();
  await expect(game).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#navigation-game")).toHaveCSS("opacity", "1");
  assert.deepEqual(await page.locator(".market-canvas").boundingBox(), chart, "Navigation must not move the chart");
  await page.screenshot({ path: resolve(directory, "navigation-desktop.png") });
  await page.keyboard.press("Escape");
  await expect(game).toBeFocused();
  await expect(page.locator("#navigation-game")).toHaveAttribute("inert", "");
  await navigation.getByRole("button", { name: "Protocol", exact: true }).click();
  await expect(page.locator("#navigation-protocol").getByRole("link", { name: /MagicBlock/ })).toHaveAttribute("href", "https://docs.magicblock.gg/");
  const wallet = page.getByRole("button", { name: "Connect wallet", exact: true });
  await wallet.click();
  await expect(page.locator("#navigation-protocol")).toHaveAttribute("inert", "");
  await expect(page.locator(".wallet-adapter-modal[role=dialog]")).toBeVisible();
  await page.locator(".wallet-adapter-modal-button-close").click();
  await expect(page.locator(".wallet-adapter-modal[role=dialog]")).toHaveCount(0);
  await wallet.hover();
  await expect(wallet).toHaveCSS("border-radius", "10px");
  await expect(wallet).toHaveCSS("background-color", "rgb(234, 240, 250)");
  await expect(wallet).toHaveCSS("color", "rgb(16, 16, 19)");
  assert.equal(await wallet.evaluate(element => getComputedStyle(element).boxShadow), "none", "Wallet uses one clear face without stacked rims");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(wallet).toHaveCSS("animation-name", "none");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const footerLayouts = [];
  for (const width of [375, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    if (width <= 1100) {
      const toggle = page.getByRole("button", { name: "Open menu", exact: true });
      await toggle.click();
      await expect(navigation).toBeVisible();
      await game.click();
      await expect(game).toHaveAttribute("aria-expanded", "true");
      await page.screenshot({ path: resolve(directory, `navigation-${width}.png`) });
      await page.keyboard.press("Escape");
      await expect(toggle).toBeFocused();
      await expect(page.locator("#site-navigation")).toHaveAttribute("inert", "");
    }
    const footer = page.getByRole("contentinfo", { name: "About FLINCH" });
    await footer.scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await expect(footer.getByRole("link", { name: "Solana", exact: true })).toHaveAttribute("href", "https://solana.com/docs");
    const bounds = await footer.boundingBox();
    const artwork = await footer.locator(".footer-scene").boundingBox();
    assert(bounds && artwork);
    assert(bounds.height <= 760, "Footer should preserve its intended proportions");
    assert.equal(bounds.x, 0, "Footer must reach the viewport edge");
    assert.equal(bounds.width, width, "Footer must fill the viewport");
    await expect(footer).toHaveCSS("border-width", "0px");
    await expect(footer).toHaveCSS("margin", "0px");
    await expect(footer.locator(".footer-hand")).toHaveCount(2);
    await expect(footer.locator(".footer-hand-left")).toHaveCSS("opacity", "1");
    const lockup = await footer.locator(".footer-lockup").boundingBox();
    assert(lockup && lockup.x >= 16 && lockup.x + lockup.width <= width - 16, "Wordmarks must fit inside the viewport");
    assert(Math.abs(lockup.x + lockup.width / 2 - width / 2) <= 1, "Wordmarks must be centered");
    assert.equal(artwork.width, bounds.width, "Hand scene must fill the footer width");
    for (const control of await footer.locator("a, button, summary").all()) {
      const target = await control.boundingBox();
      assert(target && target.width >= 40 && target.height >= 40, "Footer controls need usable touch targets");
    }
    footerLayouts.push({ width, height: bounds.height, fullBleed: true, centeredLockup: true, referenceHands: true, touchTargets: true });
    await footer.screenshot({ path: resolve(directory, `footer-${width}.png`) });
    const details = footer.locator("summary");
    await details.click();
    await expect(footer.getByText("Preview only. Gameplay is not deployed yet.", { exact: true })).toBeVisible();
    await details.click();
    const rules = footer.getByRole("button", { name: "Read the rules", exact: true });
    await rules.focus();
    await page.keyboard.press("Shift+Tab");
    await expect(details).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(rules).toBeFocused();
    await expect(rules).toHaveCSS("outline-style", "solid");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: "How to play" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(footer.getByRole("button", { name: "Read the rules", exact: true })).toBeFocused();
    await footer.getByRole("button", { name: "Back to arena", exact: true }).click();
    await expect(page.locator("#arena")).toBeFocused();
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  return { desktopNavigation: true, mobileNavigation: true, walletModal: true, reducedMotion: true, footerActions: true, footerLayouts };
}
