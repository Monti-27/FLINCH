import assert from "node:assert/strict";
import { resolve } from "node:path";
import type { Page } from "@playwright/test";

export async function checkChartLayout(page: Page, directory: string) {
  const layouts = [];
  for (const width of [1920, 1440, 1280, 1024, 768, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const geometry = await page.evaluate(() => {
      const box = (selector: string) => {
        const rect = document.querySelector(selector)!.getBoundingClientRect();
        return { x: rect.x, right: rect.right, top: rect.top + scrollY, bottom: rect.bottom + scrollY, height: rect.height };
      };
      return { chart: box(".market-canvas"), market: box(".market-panel"), entry: box(".room-entry"),
        create: box(".create-action"), overflow: document.documentElement.scrollWidth > innerWidth };
    });
    assert(!geometry.overflow, `Horizontal overflow at ${width}`);
    assert(geometry.chart.height >= 280 && geometry.chart.height <= 520);
    assert(geometry.chart.x > geometry.market.x && geometry.chart.right < geometry.market.right);
    if (width > 900) {
      assert.equal(geometry.entry.top, geometry.market.top);
      assert.equal(geometry.entry.bottom, geometry.market.bottom);
      assert(geometry.entry.right < geometry.market.x);
    } else {
      assert(geometry.entry.bottom < geometry.market.top);
      assert.equal(geometry.entry.x, geometry.market.x);
    }
    await page.screenshot({ path: resolve(directory, `arena-${width}.png`), fullPage: true });
    layouts.push({ width, ...geometry, createAboveFold: geometry.create.bottom <= 900 });
  }
  return { scope: "Chart containment and action/chart alignment; create-button fold position is recorded, not certified", layouts };
}
