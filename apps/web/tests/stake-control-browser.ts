import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

const url = process.env.FLINCH_UI_URL ?? "http://127.0.0.1:3400/play";
assert.equal(new URL(url).hostname, "127.0.0.1");
const directory = resolve(`artifacts/runs/stake-browser-${Date.now()}`);
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.FLINCH_BROWSER_EXECUTABLE });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, reducedMotion: "no-preference" });
const errors: string[] = [];
const submissions: string[] = [];
page.on("pageerror", error => errors.push(error.message));
page.setDefaultTimeout(15_000);
await page.route("**/*", async route => {
  if (route.request().method() === "POST") {
    const payload = route.request().postDataJSON();
    for (const call of Array.isArray(payload) ? payload : [payload]) {
      if (typeof call?.method === "string" && !/^get\w+$/.test(call.method)) {
        submissions.push(call.method);
        return route.abort("blockedbyclient");
      }
    }
  }
  await route.continue();
});

async function motionState(target: Page) {
  return target.locator(".token-input").evaluate(element => {
    const counter = element.querySelector("number-flow-react");
    return { active: counter?.shadowRoot?.getAnimations().filter(animation => animation.playState === "running").length ?? 0,
      value: element.querySelector("[data-number-value]")?.getAttribute("data-number-value"),
      motion: element.querySelector("[data-number-motion]")?.getAttribute("data-number-motion") };
  });
}

try {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  const amount = page.getByLabel("Stake per player, in SOL");
  const plus = page.getByRole("button", { name: "Increase stake by 0.001 SOL", exact: true });
  const minus = page.getByRole("button", { name: "Decrease stake by 0.001 SOL", exact: true });
  const presets = page.getByRole("group", { name: "Stake presets" });
  const slider = page.getByRole("slider", { name: "Adjust stake", exact: true });
  await expect(amount).toHaveValue("0.001");
  await page.evaluate(() => document.fonts.ready);
  await expect(minus).toBeDisabled();
  await plus.click();
  await expect(amount).toHaveValue("0.002");
  await minus.click();
  await expect(amount).toHaveValue("0.001");
  await presets.getByRole("button", { name: "0.005 SOL", exact: true }).click();
  await expect(amount).toHaveValue("0.005");
  await page.getByRole("button", { name: "Use maximum stake, 0.01 SOL", exact: true }).click();
  await expect(amount).toHaveValue("0.01");
  await expect(plus).toBeDisabled();
  await expect(slider).toHaveValue("90");
  await minus.focus();
  await page.keyboard.press("Space");
  await expect(amount).toHaveValue("0.009");
  await amount.fill("0.001000001");
  await page.keyboard.press("ArrowUp");
  await expect(amount).toHaveValue("0.002000001");
  await page.keyboard.press("Shift+ArrowDown");
  await expect(amount).toHaveValue("0.001900001");
  await page.keyboard.press("Tab");
  await expect(amount).toHaveValue("0.001900001");
  await expect(page.locator('.token-input [data-number-value="0.001900001"]')).toBeVisible();
  await slider.focus();
  await page.keyboard.press("Home");
  await expect(amount).toHaveValue("0.001");
  await page.keyboard.press("ArrowRight");
  await expect(amount).toHaveValue("0.0011");
  await page.keyboard.press("End");
  await expect(amount).toHaveValue("0.01");
  const track = await slider.boundingBox();
  assert(track);
  await page.mouse.move(track.x + track.width - 9, track.y + track.height / 2);
  await page.mouse.down();
  await page.mouse.move(track.x + track.width / 2, track.y + track.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(amount).toHaveValue("0.0055");
  await amount.fill("0.");
  await page.keyboard.press("Tab");
  await expect(amount).toHaveValue("0.");
  await plus.click();
  await expect(amount).toHaveValue("0.001");
  await presets.getByRole("button", { name: "0.005 SOL", exact: true }).click();
  await expect.poll(async () => (await motionState(page)).active).toBe(0);
  await expect.poll(async () => (await motionState(page)).motion).toBe("enabled");
  const relativeButton = () => plus.evaluate(element => {
    const button = element.getBoundingClientRect();
    const panel = element.closest(".token-input")!.getBoundingClientRect();
    return { x: button.x - panel.x, y: button.y - panel.y, width: button.width, height: button.height };
  });
  const stable = await relativeButton();
  await plus.click();
  const increasing = await motionState(page);
  assert(increasing.active > 0, "Stake digits must actually animate after an increase");
  assert.equal(increasing.value, "0.006");
  await page.locator(".lobby-section").screenshot({ path: resolve(directory, "increasing.png"), animations: "allow" });
  await minus.click();
  const decreasing = await motionState(page);
  assert(decreasing.active > 0, "Reverse input must interrupt the current number animation");
  await plus.evaluate(element => { for (let index = 0; index < 3; index++) (element as HTMLButtonElement).click(); });
  await expect(amount).toHaveValue("0.008");
  await expect.poll(async () => (await motionState(page)).active).toBe(0);
  assert.deepEqual(await relativeButton(), stable, "The adjustment hit target must not move with the digits");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(async () => (await motionState(page)).motion).toBe("disabled");
  await minus.click();
  assert.equal((await motionState(page)).active, 0);
  assert.equal(await presets.evaluate(element => getComputedStyle(element, "::before").transitionDuration), "0s");
  await expect(amount).toHaveValue("0.007");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("button", { name: "Have a room code?", exact: true }).click();
  const invite = page.getByLabel("Room address or invite link", { exact: true });
  await invite.fill("draft-invite");
  await page.getByRole("button", { name: "New round", exact: true }).click();
  await expect(amount).toHaveValue("0.007");
  await page.getByRole("button", { name: "Have a room code?", exact: true }).click();
  await expect(invite).toHaveValue("draft-invite");
  await page.getByRole("button", { name: "Open room", exact: true }).click();
  await expect(invite).toBeFocused();
  await expect(invite).toHaveAttribute("aria-invalid", "true");
  await page.locator("[data-sonner-toast]").getByRole("button", { name: "Close toast", exact: true }).click();
  await page.getByRole("button", { name: "New round", exact: true }).click();
  const sizes = [];
  for (const width of [320, 375, 768, 1024, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator(".entry-view")).toHaveCSS("transform", "none");
    await amount.fill("0.001000001");
    assert(await amount.evaluate(element => {
      const input = element as HTMLInputElement;
      const style = getComputedStyle(input);
      const context = document.createElement("canvas").getContext("2d")!;
      context.font = style.font;
      return context.measureText(input.value).width + (parseFloat(style.letterSpacing) || 0) * (input.value.length - 1) <= input.clientWidth;
    }), `Exact stake text must fit at ${width}px`);
    await page.keyboard.press("Tab");
    await expect.poll(async () => (await motionState(page)).active).toBe(0);
    const number = page.locator(".token-input [data-number-value]");
    assert(await number.evaluate(element => element.scrollWidth <= element.parentElement!.clientWidth), `Exact rolled digits must fit at ${width}px`);
    for (const control of await page.locator(".lobby-section button, .lobby-section input").all()) {
      const box = await control.boundingBox();
      assert(box && box.width >= 40 && box.height >= 40, `Room control too small at ${width}px: ${await control.getAttribute("aria-label")} ${JSON.stringify(box)}`);
      if (await control.isEnabled()) assert(await control.evaluate(element => {
        const rect = element.getBoundingClientRect();
        if (rect.bottom > innerHeight || rect.top < 0) return true;
        return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
      }), `Room control overlapped at ${width}px`);
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const actionBottom = await page.locator(".create-action").evaluate(element => element.getBoundingClientRect().bottom + scrollY);
    assert(actionBottom <= 900, `Create must be in the initial viewport at ${width}px, not only after scrolling`);
    await page.locator(".lobby-section").screenshot({ path: resolve(directory, `precise-${width}.png`) });
    await presets.getByRole("button", { name: "0.005 SOL", exact: true }).click();
    await expect.poll(async () => (await motionState(page)).active).toBe(0);
    await page.locator(".lobby-section").screenshot({ path: resolve(directory, `panel-${width}.png`) });
    sizes.push({ width, actionBottom, panel: await page.locator(".lobby-section").boundingBox() });
  }
  const touch = await browser.newContext({ viewport: { width: 375, height: 900 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  const mobile = await touch.newPage();
  await mobile.goto(url, { waitUntil: "domcontentloaded" });
  await mobile.getByRole("button", { name: "Increase stake by 0.001 SOL", exact: true }).tap();
  await expect(mobile.getByLabel("Stake per player, in SOL")).toHaveValue("0.002");
  await mobile.getByRole("button", { name: "0.005 SOL", exact: true }).tap();
  await expect(mobile.getByLabel("Stake per player, in SOL")).toHaveValue("0.005");
  await touch.close();
  assert.deepEqual(errors, []);
  assert.deepEqual(submissions, []);
  assert.equal(new URL(page.url()).searchParams.has("room"), false);
  writeFileSync(resolve(directory, "result.json"), JSON.stringify({ complete: true, url, readOnly: true, sizes, increasing, decreasing,
    exactInput: true, bounds: true, keyboard: true, dragging: true, interruptions: true, reducedMotion: true, preservedDrafts: true,
    touch: true, submissions, pageErrors: errors }, null, 2));
  console.log(`Stake controls passed: ${directory}`);
} catch (error) {
  await page.screenshot({ path: resolve(directory, "failure.png"), fullPage: true });
  console.error(`Stake control evidence: ${directory}`);
  throw error;
} finally { await browser.close(); }
