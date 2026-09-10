import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const url = process.env.FLINCH_UI_URL ?? "http://127.0.0.1:3108/play";
assert.equal(new URL(url).hostname, "127.0.0.1");
const directory = resolve(`artifacts/runs/number-live-${Date.now()}`);
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.FLINCH_BROWSER_EXECUTABLE });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const errors: string[] = [];
page.on("pageerror", error => errors.push(error.message));
page.setDefaultTimeout(20_000);

try {
  await page.goto(url);
  await expect(page.getByText("Live reference", { exact: true })).toBeVisible({ timeout: 30_000 });
  const price = page.locator(".market-price strong [data-number-value]");
  await expect(price).toHaveAttribute("data-number-motion", "enabled");
  const flow = price.locator("number-flow-react");
  await expect(flow).toHaveAttribute("aria-label", /^\$\d+\.\d{2}$/);
  assert(await flow.evaluate(element => element.shadowRoot !== null));
  await page.evaluate(() => document.fonts.ready);
  const layouts = [];
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    await price.scrollIntoViewIfNeeded();
    const presentation = await flow.evaluate(element => {
      const rect = element.getBoundingClientRect();
      const container = element.closest(".market-panel")!.getBoundingClientRect();
      return { font: getComputedStyle(element).fontFamily, size: getComputedStyle(element).fontSize,
        inheritedFont: getComputedStyle(element.closest("strong")!).fontFamily,
        inheritedSize: getComputedStyle(element.closest("strong")!).fontSize,
        fits: rect.left >= container.left && rect.right <= container.right,
        documentOverflow: document.documentElement.scrollWidth > innerWidth };
    });
    assert.equal(presentation.size, presentation.inheritedSize);
    assert.equal(presentation.font, presentation.inheritedFont);
    assert(presentation.fits);
    assert.equal(presentation.documentOverflow, false);
    layouts.push({ width, ...presentation });
    await page.locator(".market-panel").screenshot({ path: resolve(directory, `reference-${width}.png`) });
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(price).toHaveAttribute("data-number-motion", "disabled");
  await expect(price).toHaveAttribute("data-number-direction", "neutral");
  assert.equal(await flow.evaluate(element => element.shadowRoot!.getAnimations().length), 0);
  const input = page.getByLabel("Stake per player, in SOL", { exact: true });
  await input.fill("0.001000001");
  await expect(input).toHaveValue("0.001000001");
  await expect(page.getByRole("button", { name: "Create room", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "How to play", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("button", { name: "How to play", exact: true })).toBeFocused();
  await page.goto(new URL("/", url).toString());
  await page.getByRole("link", { name: "Open app", exact: true }).click();
  await expect(page.getByRole("button", { name: "Connect wallet", exact: true })).toBeVisible();
  await expect(page.locator(".market-price number-flow-react").first()).toHaveAttribute("aria-label", /^\$\d+\.\d{2}$/, { timeout: 30_000 });
  assert.deepEqual(errors, []);
  writeFileSync(resolve(directory, "result.json"), JSON.stringify({ complete: true, readOnly: true, realCoinbaseFeed: true,
    layouts, actualNumberFlow: true, reducedMotion: true, exactInput: true, disabledCreate: true,
    dialogKeyboard: true, clientNavigation: true, pageErrors: errors }, null, 2));
  console.log(`Production number checks passed: ${directory}`);
} catch (error) {
  await page.screenshot({ path: resolve(directory, "failure.png"), fullPage: true });
  console.error(`Production number evidence: ${directory}`, errors);
  throw error;
} finally { await browser.close(); }
