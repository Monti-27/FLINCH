import assert from "node:assert/strict";
import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

export async function checkChartControls(page: Page) {
  await page.getByRole("button", { name: "1m", exact: true }).click();
  const chart = page.locator(".market-canvas");
  await expect(chart.locator("canvas")).not.toHaveCount(0);
  const withoutVolume = await chart.locator("canvas").count();
  const volume = page.getByRole("button", { name: "Show volume", exact: true });
  await expect(volume).toHaveAttribute("aria-pressed", "false");
  await volume.click();
  await expect(volume).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => chart.locator("canvas").count()).toBeGreaterThan(withoutVolume);
  await volume.click();
  await expect(chart.locator("canvas")).toHaveCount(withoutVolume);
  const style = page.getByRole("combobox", { name: "Chart style", exact: true });
  for (const value of ["hollow", "bars", "line", "mountain", "candles"]) {
    await style.selectOption(value);
    await expect(style).toHaveValue(value);
    await expect(chart).toHaveAttribute("aria-label", new RegExp(`1-minute ${value}`));
  }
  for (const minutes of [2, 5, 1]) {
    await page.getByRole("button", { name: `${minutes}m`, exact: true }).click();
    await expect(chart).toHaveAttribute("aria-label", new RegExp(`${minutes}-minute candles`));
  }
  for (const width of [320, 375, 768, 1024, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    const bounds = await page.locator(".chart-toolbar button, .chart-toolbar select").evaluateAll(elements => elements.map(element => {
      const box = element.getBoundingClientRect();
      return { top: box.top, width: box.width, height: box.height, right: box.right };
    }));
    assert(bounds.every(box => box.top === bounds[0].top && box.width >= 40 && box.height >= 40 && box.right <= width));
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await style.focus();
  await expect(style).toHaveCSS("outline-style", "solid");
  await style.press("h");
  await expect(style).toHaveValue("hollow");
  await style.selectOption("candles");
  const fullscreen = page.getByRole("button", { name: "Fullscreen chart", exact: true });
  let expanded = false;
  if (await fullscreen.isEnabled()) {
    await fullscreen.click();
    await expect(page.getByRole("button", { name: "Exit fullscreen chart", exact: true })).toBeVisible();
    assert(await page.evaluate(() => document.fullscreenElement?.classList.contains("market-panel")));
    await page.keyboard.press("Escape");
    await expect(fullscreen).toBeFocused();
    expanded = true;
  }
  await page.getByText("About this chart", { exact: true }).click();
  await expect(page.getByRole("link", { name: "KLineCharts", exact: true })).toBeVisible();
  await expect(page.getByText(/candles and volume may be incomplete/)).toBeVisible();
  await expect(page.getByText(/not Solana onchain data/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText("About this chart", { exact: true })).toBeFocused();
  await expect(page.getByRole("link", { name: "KLineCharts", exact: true })).not.toBeVisible();
  await page.getByRole("button", { name: "Reset chart view", exact: true }).click();
  await page.mouse.move(0, 0);
  return { styles: 5, intervals: [1, 2, 5], volumeToggle: true, singleRowToolbar: true, touchTargets: true, keyboardTypeahead: true, fullscreen: expanded, attribution: true };
}
