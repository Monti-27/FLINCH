import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";
import { Keypair } from "@solana/web3.js";
import { checkLandingRendering } from "./landing-rendering.ts";
import { checkPixelGarden } from "./not-found-browser.ts";

const url = process.env.FLINCH_LANDING_URL ?? "http://127.0.0.1:3000";
const checkArena = process.env.FLINCH_LANDING_ONLY !== "true";
assert.equal(new URL(url).hostname, "127.0.0.1", "Landing checks only run against loopback");
const directory = resolve(`artifacts/runs/landing-${Date.now()}`);
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.FLINCH_BROWSER_EXECUTABLE });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
const errors: string[] = [];
const requests: string[] = [];
page.on("pageerror", error => errors.push(error.message));
page.on("request", request => requests.push(request.url()));
page.setDefaultTimeout(15_000);

try {
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  const rendering = await checkLandingRendering(page, directory);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Four players.Who flinches first?");
  await expect(page.getByRole("button", { name: "Connect wallet", exact: true })).toHaveCount(0);
  const layouts = [];
  for (const width of [320, 375, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
    const hero = page.locator('section[aria-labelledby="landing-title"]');
    await expect(hero.locator('[data-hero-art="standoff"] svg')).toBeVisible();
    await expect(hero.locator("[data-hero-player]")).toHaveCount(4);
    const illustration = await hero.locator('[data-hero-art="standoff"]').boundingBox();
    for (const player of await hero.locator("[data-hero-player]").all()) {
      const playerBounds = await player.boundingBox();
      assert(illustration && playerBounds && playerBounds.x >= illustration.x && playerBounds.x + playerBounds.width <= illustration.x + illustration.width, `${width}px clipped hero player`);
    }
    assert(await hero.evaluate(element => {
      const heading = element.querySelector("h1")!.getBoundingClientRect();
      const caption = element.querySelector("figcaption")!.getBoundingClientRect();
      const description = element.querySelector("p")!.getBoundingClientRect();
      const disclosure = element.querySelectorAll("p")[1].getBoundingClientRect();
      const actions = [...element.querySelectorAll("a")].map(action => action.getBoundingClientRect());
      const center = (rect: DOMRect) => rect.x + rect.width / 2;
      const actionCenter = (Math.min(...actions.map(rect => rect.left)) + Math.max(...actions.map(rect => rect.right))) / 2;
      const labels = [...element.querySelectorAll("figcaption span")];
      const players = [...element.querySelectorAll("[data-hero-player]")];
      const labelAlignment = players.every((player, index) => Math.abs(center(player.getBoundingClientRect()) - center(labels[index].getBoundingClientRect())) < 1);
      return [caption, description, disclosure].every(rect => Math.abs(center(heading) - center(rect)) < 1)
        && Math.abs(center(heading) - actionCenter) < 1 && labelAlignment
        && heading.bottom < description.top && description.bottom < actions[0].top
        && Math.max(...actions.map(rect => rect.bottom)) < disclosure.top && disclosure.bottom < caption.top;
    }), `${width}px hero alignment`);
    const primary = page.getByRole("link", { name: "Enter the arena", exact: true }).first();
    const bounds = await primary.boundingBox();
    assert(bounds && bounds.height >= 44 && bounds.y + bounds.height <= 900);
    assert(await primary.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
    }));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: resolve(directory, `hero-${width}.png`) });
    await page.locator("#onchain").scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(directory, `protocol-${width}.png`) });
    await page.locator("#questions").scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(directory, `questions-${width}.png`) });
    await page.locator(".app-footer").scrollIntoViewIfNeeded();
    await expect(page.locator(".footer-lockup")).toBeVisible();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: resolve(directory, `footer-${width}.png`) });
    layouts.push({ width, noOverflow: true, primaryVisible: true });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator("[data-story-chapter]")).toHaveCount(0);
  await expect(page.locator("#onchain")).toHaveCount(1);
  await expect(page.locator("[data-bento-card]")).toHaveCount(5);
  for (const scene of ["custody", "rollup", "decision", "holders", "settlement", "custody"]) {
    const card = page.locator(`[data-bento-card="${scene}"]`);
    await card.evaluate(element => element.scrollIntoView({ block: "center", behavior: "instant" }));
    await expect(card).toBeVisible();
    assert.equal(await card.evaluate(element => getComputedStyle(element).position), "relative");
    await page.screenshot({ path: resolve(directory, `scene-${scene}.png`) });
  }
  await page.goto(url);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to the story" })).toBeFocused();
  await expect(page.getByRole("link", { name: "Skip to the story" })).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Enter the arena", exact: true }).first()).toBeFocused();
  await expect(page.getByRole("link", { name: "Enter the arena", exact: true }).first()).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "How to play", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#onchain$/);
  await expect(page.locator("#onchain h2")).toBeInViewport();
  await page.goto(`${new URL(url).origin}/#how-it-works`);
  await expect(page.locator("#onchain h2")).toBeInViewport();
  await page.locator("#questions").scrollIntoViewIfNeeded();
  const question = page.locator("#questions summary").first();
  await question.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#questions details").first()).toHaveAttribute("open", "");
  await expect(page.locator("#questions details").first().locator("p")).toBeVisible();
  await page.getByRole("button", { name: "Read the rules", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByRole("button", { name: "Read the rules", exact: true })).toBeFocused();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.reload();
  await expect.poll(() => page.locator('[data-hero-art="standoff"]').evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
  await page.locator("#questions").scrollIntoViewIfNeeded();
  await expect(page.locator("#questions h2")).toHaveAttribute("data-revealed", "true");
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(await page.locator('[data-hero-art="standoff"]').evaluate(element => element.getAnimations({ subtree: true }).length), 0);
  await expect.poll(() => page.locator("[data-reveal]").evaluateAll(elements => elements.every(element => getComputedStyle(element).opacity === "1"))).toBe(true);
  assert(await page.locator("[data-reveal]").evaluateAll(elements => elements.every(element => element.getAnimations({ subtree: true }).length === 0)));
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior), "auto");
  const external = requests.filter(request => ["http:", "https:"].includes(new URL(request).protocol) && new URL(request).origin !== new URL(url).origin);
  assert.deepEqual(external, [], "Landing must not request external wallets, RPCs or media");
  assert(requests.every(request => !request.includes("/api/market")), "Landing must not mount the market feed");
  const staticPage = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 375, height: 900 } });
  await staticPage.goto(url);
  await expect(staticPage.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(staticPage.locator('[data-hero-art="standoff"] svg')).toBeVisible();
  await expect(staticPage.locator("[data-hero-player]")).toHaveCount(4);
  await staticPage.screenshot({ path: resolve(directory, "hero-no-javascript.png") });
  await staticPage.locator("#questions summary").first().click();
  await expect(staticPage.locator("#questions details").first().locator("p")).toBeVisible();
  await expect(staticPage.getByRole("link", { name: "Open app", exact: true })).toHaveAttribute("href", "/play");
  await staticPage.close();
  if (checkArena) {
    await page.getByRole("link", { name: "Open app", exact: true }).click();
    await expect(page).toHaveURL(`${new URL(url).origin}/play`);
    await expect(page.getByRole("button", { name: "Connect wallet", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create room", exact: true })).toBeDisabled();
  }
  const address = Keypair.generate().publicKey.toBase58();
  const legacy = await page.request.get(`${url}/?room=${address}&unshared=value`, { maxRedirects: 0 });
  assert.equal(legacy.status(), 307);
  assert.equal(legacy.headers().location, `/play?room=${address}`);
  for (const query of ["room=invalid", `room=${address}&room=${address}`]) {
    const invalid = await page.request.get(`${url}/?${query}`, { maxRedirects: 0 });
    assert.equal(invalid.status(), 200);
    assert((await invalid.text()).replace(/<[^>]*>/g, "").includes("Who flinches first?"));
  }
  const garden = await checkPixelGarden(browser, url, directory);
  assert.deepEqual(errors, []);
  writeFileSync(resolve(directory, "result.json"), JSON.stringify({ complete: true, layouts, rendering, garden, heroAlignment: true, fourVisiblePlayers: true, finiteHeroMotion: true, singleBento: true, legacyAnchor: true, bentoForwardAndReverse: true,
    keyboard: true, rules: true, nativeFaq: true, liveReducedMotion: true, noJavaScriptContent: true,
    noLandingExternalTraffic: true, noLandingMarketFeed: true, arenaNavigation: checkArena, legacyRoomRedirect: true, pageErrors: errors }, null, 2));
  console.log(`Landing checks passed: ${directory}`);
} catch (error) {
  await page.screenshot({ path: resolve(directory, "failure.png"), fullPage: true });
  console.error(`Landing evidence: ${directory}`);
  throw error;
} finally { await browser.close(); }
