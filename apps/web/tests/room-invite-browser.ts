import assert from "node:assert/strict";
import { resolve } from "node:path";
import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

export async function checkRoomInvite(page: Page, address: string, directory: string) {
  const origin = new URL(page.url()).origin;
  const link = `${origin}/play?room=${address}`;
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin });
  await page.evaluate(() => {
    const url = new URL(location.href);
    url.searchParams.set("unshared", "test-value"); url.hash = "not-shared";
    history.replaceState(null, "", url);
  });
  const invite = page.getByRole("button", { name: "Invite players: copy invite link", exact: true });
  for (const width of [320, 375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const before = await invite.boundingBox();
    assert(before && before.width >= 40 && before.height >= 40);
    await invite.focus();
    await page.keyboard.press("Enter");
    await expect(invite).toHaveAttribute("data-copied", "true");
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), link);
    assert.deepEqual(await invite.boundingBox(), before, "Copy feedback cannot shift the toolbar");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await expect(invite).toHaveAttribute("data-copied", "false");
  }
  await page.setViewportSize({ width: 375, height: 900 });
  await page.evaluate(() => Object.defineProperty(navigator.clipboard, "writeText", {
    configurable: true, value: () => Promise.reject(new Error("Clipboard access denied by test")),
  }));
  await invite.click();
  const input = page.getByLabel("Room invite link", { exact: true });
  await expect(input).toBeFocused();
  await expect(input).toHaveValue(link);
  assert(await input.evaluate(element => element instanceof HTMLInputElement
    && element.selectionStart === 0 && element.selectionEnd === element.value.length));
  const field = await input.boundingBox();
  assert(field && field.x >= 0 && field.x + field.width <= 375);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: resolve(directory, "invite-manual-375.png"), fullPage: true });
  await page.keyboard.press("Escape");
  await expect(input).toHaveCount(0);
  await expect(invite).toBeFocused();
  await page.evaluate(() => Reflect.deleteProperty(navigator.clipboard, "writeText"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await invite.click();
  await expect(invite).toHaveAttribute("data-copied", "true");
  assert(await invite.locator("span").evaluateAll(elements => elements.every(element => getComputedStyle(element).transitionDuration === "0s")));
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: resolve(directory, "room-invite-1280.png"), fullPage: true });
  await page.evaluate(value => history.replaceState(null, "", value), link);
  return link;
}
