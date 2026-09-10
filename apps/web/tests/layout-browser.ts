import assert from "node:assert/strict";
import { resolve } from "node:path";
import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

export async function checkLayout(page: Page, directory: string) {
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    return [document.body, document.querySelector("h1")!].map(element => {
      const family = getComputedStyle(element).fontFamily.split(",")[0].trim().replaceAll('"', "");
      const loaded = [...document.fonts].some(font => font.family.replaceAll('"', "") === family && font.status === "loaded");
      return { family, loaded };
    });
  });
  assert.match(fonts[0].family, /manrope/i);
  assert.match(fonts[1].family, /spaceGrotesk/i);
  assert(fonts.every(font => font.loaded), "The selected fonts must load, not just appear in a fallback stack");
  const widths = [1920, 1440, 1280, 1024, 768, 375];
  const layouts = [];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    const geometry = await page.evaluate(() => {
      const frame = document.querySelector(".app-frame")!.getBoundingClientRect();
      const card = document.querySelector(".market-panel")!;
      const chart = document.querySelector(".market-canvas")!.getBoundingClientRect();
      const market = card.getBoundingClientRect();
      const table = document.querySelector(".standoff")!.getBoundingClientRect();
      const entry = document.querySelector(".room-entry")!.getBoundingClientRect();
      const style = getComputedStyle(card);
      return {
        frame: { x: frame.x, width: frame.width, height: frame.height },
        chart: { x: chart.x, right: chart.right, height: chart.height },
        market: { x: market.x, right: market.right, top: market.top, bottom: market.bottom },
        table: { x: table.x, right: table.right, top: table.top, bottom: table.bottom },
        entry: { x: entry.x, right: entry.right, top: entry.top, bottom: entry.bottom },
        border: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth],
        overflow: document.documentElement.scrollWidth > window.innerWidth,
      };
    });
    assert.equal(geometry.frame.x, 0);
    assert.equal(geometry.frame.width, width, `App is inset at ${width}`);
    assert(geometry.frame.height >= 900, `App does not fill the viewport at ${width}`);
    assert(!geometry.overflow, `Horizontal overflow at ${width}`);
    assert(geometry.chart.height >= 280 && geometry.chart.height <= 520, `Chart is not bounded at ${width}`);
    assert(geometry.chart.x > geometry.market.x && geometry.chart.right < geometry.market.right);
    assert(geometry.border.every(border => border === "1px"), "Chart must have a complete border");
    assert(geometry.market.top > geometry.table.bottom, "Round status must lead the reference chart");
    if (width > 900) {
      assert.equal(geometry.entry.top, geometry.market.top, "Action panel and chart must share a top edge");
      assert.equal(geometry.entry.bottom, geometry.market.bottom, "Action panel and chart must share a bottom edge");
      assert(geometry.entry.right < geometry.market.x, "Actions lead the reference chart on desktop");
    } else {
      assert(geometry.entry.bottom < geometry.market.top, "Actions must precede the reference chart on mobile");
      assert.equal(geometry.entry.x, geometry.market.x, "Stacked actions and chart share a left edge");
    }
    if (width > 1100) {
      const sidebar = await page.locator(".player-rail").boundingBox();
      assert(sidebar && sidebar.x === geometry.table.x && sidebar.width > width * .8, "Players span the game surface");
      const seats = await page.locator(".player-slot").evaluateAll(elements => elements.map(element => element.getBoundingClientRect().y));
      assert(seats.every(y => y === seats[0]), "All four players must share one row");
      await expect(page.getByRole("button", { name: /Player 1, open seat/ })).toBeVisible();
      const create = await page.getByRole("button", { name: "Create room", exact: true }).boundingBox();
      assert(create && create.y + create.height <= 900, `Create action is below the desktop fold at ${width}: ${JSON.stringify(create)}`);
    }
    const action = await page.getByRole("button", { name: "Create room", exact: true }).boundingBox();
    assert(action && action.y + action.height <= 900, `Entry action is below the first fold at ${width}`);
    await expect(page.getByRole("button", { name: "Have a room code?", exact: true })).toBeVisible();
    await page.screenshot({ path: resolve(directory, `arena-${width}.png`), fullPage: true });
    layouts.push({ width, ...geometry });
  }
  return { fonts, layouts };
}
