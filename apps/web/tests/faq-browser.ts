import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const url = process.env.FLINCH_FAQ_URL ?? "http://127.0.0.1:3400";
assert.equal(new URL(url).hostname, "127.0.0.1");
const directory = resolve(`artifacts/runs/faq-${Date.now()}`);
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.FLINCH_BROWSER_EXECUTABLE });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, reducedMotion: "no-preference" });
const errors: string[] = [];
page.on("pageerror", error => errors.push(error.message));
page.setDefaultTimeout(15_000);
const rows = page.locator("[data-faq] details");
const summaries = page.locator("[data-faq] summary");
const settled = async () => {
  await expect.poll(() => rows.evaluateAll(elements => elements.every(element => !(element as HTMLElement).style.height))).toBe(true);
};
const closeAll = async () => {
  const open = page.locator('[data-faq] details[data-expanded="true"] summary');
  if (await open.count()) await open.click();
  await settled();
};

try {
  await page.goto(`${url}/#questions`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("[data-faq]")).toHaveAttribute("data-enhanced", "true");
  await expect(rows).toHaveCount(5);
  await page.locator("#questions").scrollIntoViewIfNeeded();
  await expect(page.locator("#questions h2")).toHaveAttribute("data-revealed", "true");
  await page.locator("#questions").evaluate(async element => {
    await Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished));
  });
  const closedLayout = await page.locator("[data-faq]").evaluate(element => {
    const style = getComputedStyle(element);
    const bounds = element.getBoundingClientRect();
    const introduction = element.previousElementSibling!.getBoundingClientRect();
    return { parent: element.parentElement!.id, height: bounds.height, gap: bounds.top - introduction.bottom, radius: style.borderRadius, background: style.backgroundImage, padding: style.padding };
  });
  assert.equal(closedLayout.parent, "questions", "FAQ must sit directly inside the page section");
  assert(closedLayout.height <= 330 && closedLayout.gap >= 24 && closedLayout.gap <= 40, "Closed FAQ must not reserve an empty display panel");
  assert.equal(closedLayout.radius, "0px");
  assert.equal(closedLayout.background, "none");
  assert.equal(closedLayout.padding, "0px");
  await page.screenshot({ path: resolve(directory, "closed.png") });
  await page.locator("#questions").screenshot({ path: resolve(directory, "closed-section.png") });
  const motion = await rows.first().evaluate(async element => {
    const details = element as HTMLDetailsElement;
    const samples: { time: number; height: number; open: boolean; surface: string }[] = [];
    const start = performance.now();
    details.querySelector("summary")!.click();
    await new Promise<void>(done => {
      const sample = () => {
        samples.push({ time: performance.now() - start, height: details.getBoundingClientRect().height, open: details.open, surface: details.style.getPropertyValue("--faq-open") });
        if (performance.now() - start < 900) requestAnimationFrame(sample);
        else done();
      };
      requestAnimationFrame(sample);
    });
    return samples;
  });
  writeFileSync(resolve(directory, "motion.json"), JSON.stringify(motion, null, 2));
  assert(motion.length > 10);
  assert(motion[0].height < motion.at(-1)!.height - 10, "Expansion must not snap to its final height");
  assert(new Set(motion.map(sample => sample.height)).size > 8);
  assert(motion.find(sample => sample.time > 400)!.height > motion.at(-1)!.height * .95);
  await settled();
  await summaries.first().focus();
  await page.keyboard.press("Space");
  await expect(rows.first()).not.toHaveAttribute("open");
  await page.keyboard.press("Enter");
  await expect(summaries.first()).toHaveAttribute("aria-expanded", "true");
  await expect(summaries.first()).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("ArrowDown");
  await expect(summaries.nth(1)).toBeFocused();
  await page.keyboard.press("End");
  await expect(summaries.last()).toBeFocused();
  await page.keyboard.press("Home");
  await expect(summaries.first()).toBeFocused();
  await closeAll();
  await summaries.first().evaluate(element => element.blur());

  const flows = [];
  for (let iteration = 0; iteration < 2; iteration++) {
    const samples = await rows.first().evaluate(async element => {
      const flow = element.querySelector<HTMLElement>("[data-faq-flow]")!;
      element.querySelector("summary")!.click();
      const values = [];
      for (let index = 0; index < 13; index++) {
        const style = getComputedStyle(flow);
        values.push({ opacity: Number(style.opacity), transform: style.transform });
        await new Promise(done => setTimeout(done, 100));
      }
      return values;
    });
    assert(Math.max(...samples.map(sample => sample.opacity)) > 0.5, "Opening must show the color flow");
    assert(new Set(samples.map(sample => sample.transform)).size > 6, "The colors must travel, not just fade");
    assert(samples.at(-1)!.opacity < 0.01, "The flow must settle after opening");
    flows.push(samples);
    await closeAll();
  }

  await page.locator("[data-faq]").evaluate(async element => {
    const triggers = [...element.querySelectorAll("summary")];
    for (const index of [0, 0, 0, 2, 1, 4, 4, 3, 1]) {
      triggers[index].click();
      await new Promise(done => setTimeout(done, 40));
    }
  });
  await settled();
  await expect(page.locator("[data-faq] details[open]")).toHaveCount(1);
  await expect(summaries.nth(1)).toHaveAttribute("aria-expanded", "true");
  await expect(rows.nth(1).locator("[data-faq-content]")).not.toHaveAttribute("inert");
  const layouts = [];
  for (const width of [320, 375, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.locator("#questions").scrollIntoViewIfNeeded();
    await settled();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const dimensions = await rows.nth(1).evaluate(element => {
      const summary = element.querySelector("summary")!.getBoundingClientRect();
      const answer = element.querySelector("[data-faq-content]")!.getBoundingClientRect();
      const row = element.getBoundingClientRect();
      return { row: row.height, content: summary.height + answer.height, hit: summary.height, clipped: answer.bottom > row.bottom + 1 };
    });
    assert(dimensions.hit >= 44 && !dimensions.clipped);
    assert(Math.abs(dimensions.row - dimensions.content) < 1);
    const alignment = await rows.nth(1).evaluate(element => {
      const question = element.querySelector("summary > span")!.getBoundingClientRect();
      const answer = element.querySelector("p")!.getBoundingClientRect();
      const style = getComputedStyle(element);
      return { offset: Math.abs(question.left - answer.left), radius: style.borderRadius, background: style.backgroundColor, rowWidth: element.getBoundingClientRect().width };
    });
    assert(alignment.offset < 1, "Answers must share their question's left edge");
    assert.equal(alignment.radius, "0px");
    assert.equal(alignment.background, "rgba(0, 0, 0, 0)");
    assert(alignment.rowWidth <= 640);
    await page.screenshot({ path: resolve(directory, `open-${width}.png`), fullPage: false });
    layouts.push({ width, ...dimensions, ...alignment, overflow: false });
  }

  await page.setViewportSize({ width: 1280, height: 1000 });
  const original = await rows.nth(1).locator("p").textContent();
  await rows.nth(1).locator("p").evaluate(element => { element.textContent = `${element.textContent} ${element.textContent}`; });
  await settled();
  assert(await rows.nth(1).evaluate(element => element.querySelector("p")!.getBoundingClientRect().bottom < element.getBoundingClientRect().bottom));
  await rows.nth(1).locator("p").evaluate((element, text) => { element.textContent = text; }, original);
  await settled();
  await closeAll();
  await summaries.first().dispatchEvent("click");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await settled();
  await expect(rows.first()).toHaveAttribute("open", "");
  assert.equal(await rows.first().evaluate(element => element.getAnimations({ subtree: true }).length), 0);
  assert.equal(await rows.first().locator("p").evaluate(element => getComputedStyle(element).filter), "none");
  await summaries.first().click();
  await expect(rows.first()).not.toHaveAttribute("open");
  await summaries.nth(2).click();
  await expect(rows.nth(2)).toHaveAttribute("open", "");
  await settled();
  await page.screenshot({ path: resolve(directory, "reduced-motion.png") });
  await closeAll();
  await rows.nth(3).evaluate(element => { (element as HTMLDetailsElement).open = true; });
  await expect(summaries.nth(3)).toHaveAttribute("aria-expanded", "true");
  await closeAll();

  await page.emulateMedia({ reducedMotion: "no-preference" });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await summaries.nth(4).click();
  await settled();
  await expect(rows.nth(4).locator("p")).toBeVisible();
  await summaries.nth(4).click();
  await settled();
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await cdp.detach();

  const staticPage = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 375, height: 900 } });
  await staticPage.goto(`${url}/#questions`);
  await staticPage.locator("#questions summary").first().click();
  await expect(staticPage.locator("#questions details").first().locator("p")).toBeVisible();
  await staticPage.screenshot({ path: resolve(directory, "no-javascript.png") });
  await staticPage.close();
  assert.deepEqual(errors, []);
  writeFileSync(resolve(directory, "result.json"), JSON.stringify({ complete: true, closedLayout, layouts, motion, flows, rapidReversal: true, keyboard: true, dynamicContent: true, liveReducedMotion: true, nativeOpening: true, noJavaScript: true, cpuThrottle4x: true, errors }, null, 2));
  console.log(`FAQ checks passed: ${directory}`);
} catch (error) {
  await page.screenshot({ path: resolve(directory, "failure.png") });
  console.error(`FAQ evidence: ${directory}`);
  throw error;
} finally { await browser.close(); }
