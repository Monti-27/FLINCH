import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

const origin = new URL(process.env.FLINCH_UI_URL ?? "http://127.0.0.1:3492").origin;
assert.equal(new URL(origin).hostname, "127.0.0.1");
const room = "/play?room=11111111111111111111111111111111";
const directory = resolve(`artifacts/runs/header-home-${Date.now()}`);
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.FLINCH_BROWSER_EXECUTABLE });
const errors: string[] = [];
const submissions: string[] = [];
const results: unknown[] = [];

async function atBeginning(page: Page) {
  await expect(page).toHaveURL(`${origin}/`);
  await expect(page.locator("#landing-title")).toBeInViewport();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
}

try {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  await context.route("**/*", route => {
    const request = route.request();
    if (request.method() === "POST") {
      const method = request.postDataJSON()?.method;
      if (method === "sendTransaction") submissions.push(method);
      return route.abort();
    }
    if (new URL(request.url()).origin !== origin) return route.abort();
    if (new URL(request.url()).pathname === "/api/market") return route.fulfill({ status: 503, body: "Test feed unavailable" });
    return route.continue();
  });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["/play", room]) {
      await page.goto(`${origin}${route}`);
      await expect(page.getByRole("button", { name: "Connect wallet", exact: true })).toBeVisible();
      const logo = page.getByRole("link", { name: "FLINCH home", exact: true });
      await expect(logo).toHaveAttribute("href", "/");
      await expect(logo).toHaveCSS("text-decoration-line", "none");
      const bounds = await logo.boundingBox();
      assert(bounds && bounds.width >= 44 && bounds.height >= 44);
      await logo.focus();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Shift+Tab");
      await expect(logo).toBeFocused();
      await expect(logo).toHaveCSS("outline-style", "solid");
      if (route === room) await page.keyboard.press("Enter");
      else await logo.click();
      await atBeginning(page);
      results.push({ width, route, homeAtTop: true });
    }
    for (const route of ["/", "/#questions"]) {
      await page.goto(`${origin}${route}`);
      await page.locator("#questions").scrollIntoViewIfNeeded();
      assert(await page.evaluate(() => scrollY > 0));
      await page.getByRole("link", { name: "FLINCH home", exact: true }).click();
      await atBeginning(page);
      results.push({ width, route, homeAtTop: true });
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: resolve(directory, `landing-top-${width}.png`) });
  }
  await page.goto(`${origin}${room}`);
  await page.getByRole("button", { name: "Lobby", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/play`);
  await expect(page.getByRole("button", { name: "Create room", exact: true })).toBeVisible();
  const newTab = context.waitForEvent("page");
  await page.getByRole("link", { name: "FLINCH home", exact: true }).click({ button: "middle" });
  const opened = await newTab;
  await atBeginning(opened);
  await opened.close();
  await expect(page).toHaveURL(`${origin}/play`);
  const staticPage = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 375, height: 900 } });
  await staticPage.goto(`${origin}${room}`);
  await staticPage.getByRole("link", { name: "FLINCH home", exact: true }).click();
  await atBeginning(staticPage);
  await staticPage.close();
  assert.deepEqual(errors, []);
  assert.deepEqual(submissions, []);
  writeFileSync(resolve(directory, "result.json"), JSON.stringify({ complete: true, results, keyboardHome: true,
    noJavaScriptHome: true, newTabHome: true, lobbyPreserved: true, noTransactions: true, pageErrors: errors }, null, 2));
  console.log(`Header home checks passed: ${directory}`);
} catch (error) {
  console.error(`Header home evidence: ${directory}`);
  for (const context of browser.contexts()) for (const page of context.pages()) {
    await page.screenshot({ path: resolve(directory, "failure.png") }).catch(() => {});
  }
  throw error;
} finally { await browser.close(); }
