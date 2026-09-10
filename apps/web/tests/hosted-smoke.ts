import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const origin = "https://flinch-game.up.railway.app";
const backend = "https://flinch-keeper.up.railway.app";
const active = process.argv[2] === "--active";
assert(process.argv.length === 2 || process.argv.length === 3 && active);
const directory = resolve(`artifacts/runs/railway-smoke-${Date.now()}`);
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.FLINCH_BROWSER_EXECUTABLE });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors: string[] = [];
page.on("pageerror", error => errors.push(error.message));
page.setDefaultTimeout(30_000);

try {
  const frontendHealth = await page.request.get(`${origin}/api/health`);
  assert.equal(frontendHealth.status(), 200);
  const frontend = await frontendHealth.json();
  assert.equal(frontend.healthy, true);
  assert.equal(frontend.network, "devnet");
  assert.equal(frontend.transactionsEnabled, active);
  assert.equal(frontend.backend, "connected");
  assert.equal(frontend.database, "connected");
  const keeperHealth = await page.request.get(`${backend}/health`);
  assert.equal(keeperHealth.status(), 200);
  const keeper = await keeperHealth.json();
  assert.equal(keeper.database, "connected");
  assert.equal(keeper.keeper, active ? "running" : "disabled");
  const landing = await page.goto(origin);
  assert.equal(landing?.status(), 200);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Who flinches first?");
  await page.screenshot({ path: resolve(directory, "landing.png"), fullPage: true });
  await page.locator("#story").getByRole("link", { name: "Enter the arena" }).click();
  await page.waitForURL(`${origin}/play`);
  await expect(page.getByRole("button", { name: "Create room", exact: true })).toBeDisabled();
  await expect(page.getByText("Live reference", { exact: true })).toBeVisible();
  const market = await page.request.get(`${origin}/api/market`);
  assert.equal(market.status(), 200);
  const candles = await market.json();
  assert(Array.isArray(candles) && candles.length > 0);
  await page.getByRole("combobox", { name: "Chart style", exact: true }).selectOption("line");
  await page.getByRole("button", { name: "5m", exact: true }).click();
  await expect(page.getByRole("button", { name: "5m", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "0.005 SOL", exact: true }).click();
  await expect(page.getByLabel("Stake per player, in SOL")).toHaveValue("0.005");
  await page.getByRole("button", { name: "Have a room code?", exact: true }).click();
  await page.getByLabel("Room address or invite link", { exact: true }).fill("invalid-room");
  await page.getByRole("button", { name: "Open room", exact: true }).click();
  await expect(page.locator('[data-sonner-toast][data-type="warning"]').filter({ hasText: "Check the room link" })).toBeVisible();
  await page.getByRole("button", { name: "How to play", exact: true }).click();
  await expect(page.locator("#navigation-rules")).toHaveCSS("opacity", "1");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Connect wallet", exact: true }).click();
  await expect(page.locator(".wallet-adapter-modal")).toBeVisible();
  await page.locator(".wallet-adapter-modal-button-close").click();
  await page.getByRole("button", { name: "New round", exact: true }).click();
  for (const width of [1280, 768, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole("button", { name: "Create room", exact: true })).toBeDisabled();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: resolve(directory, `arena-${width}.png`), fullPage: true });
  }
  await page.reload();
  await expect(page.getByText("Live reference", { exact: true })).toBeVisible();
  assert.deepEqual(errors, []);
  writeFileSync(resolve(directory, "result.json"), JSON.stringify({ complete: true, frontend, keeper,
    liveMarket: true, landingNavigation: true, invalidRoomValidation: true, rules: true, walletPicker: true,
    responsiveWidths: [1280, 768, 375], reload: true, pageErrors: errors, signingAttempted: false }, null, 2));
  console.log(`Hosted smoke passed: ${directory}`);
} catch (error) {
  await page.screenshot({ path: resolve(directory, "failure.png"), fullPage: true });
  console.error(`Hosted smoke evidence: ${directory}`);
  throw error;
} finally { await browser.close(); }
