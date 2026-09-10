import assert from "node:assert/strict";
import { resolve } from "node:path";
import { expect } from "@playwright/test";
import type { Page, Route } from "@playwright/test";
import { formatUnits } from "@flinch/client";

export function createApprovalGate() {
  let next: (() => Promise<void>) | undefined;
  return {
    beforeSign: async () => { const run = next; next = undefined; await run?.(); },
    hold: () => {
      let release!: (error?: Error) => void;
      const decision = new Promise<Error | undefined>(resolve => { release = resolve; });
      let requested = false;
      next = async () => { requested = true; const error = await decision; if (error) throw error; };
      return { requested: () => requested, release };
    },
  };
}

export async function checkWithdrawal(page: Page, directory: string, amount: bigint, gate: ReturnType<typeof createApprovalGate>, signatures: string[]) {
  const panel = page.getByRole("region", { name: "Ready to withdraw", exact: true });
  const claim = panel.getByRole("button", { name: "Claim USDC", exact: true });
  await expect(panel).toBeVisible();
  await expect(page.locator(".sell-panel")).toHaveCount(0);
  await expect(panel.getByText(formatUnits(amount, 6), { exact: true })).toBeVisible();
  for (const width of [1280, 768, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(claim).toBeEnabled();
    const button = await claim.boundingBox();
    const ticket = await panel.getByRole("article", { name: "USDC withdrawal" }).boundingBox();
    assert(button && ticket && button.height >= 44 && button.width >= ticket.width - 40);
    assert(button.y + button.height <= 900, `Claim is below the fold at ${width}`);
    assert(await claim.evaluate(element => {
      const box = element.getBoundingClientRect();
      return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
    }), `Another surface covers Claim at ${width}`);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: resolve(directory, `withdrawal-${width}.png`), fullPage: true });
  }
  const details = panel.locator("summary", { hasText: "Withdrawal details" });
  await details.focus();
  await page.keyboard.press("Enter");
  await expect(panel.getByText("Your wallet signs on Solana. Claims do not need a session key or MagicBlock.")).toBeVisible();
  assert.notEqual(await details.evaluate(element => getComputedStyle(element).outlineStyle), "none");
  await page.keyboard.press("Enter");
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(await details.locator("svg").evaluate(element => getComputedStyle(element).transitionDuration), "0s");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const approval = gate.hold();
  const before = signatures.length;
  try {
    await claim.click();
    await expect(claim).toHaveAttribute("aria-busy", "true");
    await expect(panel.getByRole("status")).toHaveText("Waiting for wallet and Solana confirmation…");
    await expect.poll(approval.requested).toBe(true);
    await expect(claim).toBeDisabled();
    assert.equal(signatures.length, before);
    await expect(panel.getByText(formatUnits(amount, 6), { exact: true })).toBeVisible();
    await page.screenshot({ path: resolve(directory, "withdrawal-wallet-approval.png"), fullPage: true });
  } finally { approval.release(new Error("User rejected the wallet request")); }
  await expect(claim).toBeEnabled();
  await expect(panel.getByRole("alert")).toHaveCount(0);
  await expect(page.locator('[data-sonner-toast][data-type="info"]').filter({ hasText: "Request cancelled" })).toBeVisible();
  assert.equal(signatures.length, before);
  await expect(panel.getByText(formatUnits(amount, 6), { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 900 });
  return { exactAmount: true, singleActionPanel: true, responsiveHitTargets: true, keyboardDetails: true,
    reducedMotion: true, approvalDoesNotClaim: true, rejectionDoesNotSign: true, rejectionPreservesAmount: true };
}

export async function claimWithoutEr(page: Page, er: string, directory: string, verify: () => Promise<void>) {
  let failures = 0;
  const fail = async (route: Route) => {
    const body = route.request().postDataJSON();
    if (body?.method !== "getIdentity") return route.continue();
    failures++;
    await route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ jsonrpc: "2.0", id: body.id, error: { code: -32000, message: "Injected ER outage during claim" } }) });
  };
  await page.route(er, fail);
  try {
    await expect(page.getByRole("status").filter({ hasText: "RPC response failed validation" })).toBeVisible();
    const claim = page.getByRole("button", { name: "Claim USDC", exact: true });
    await expect(claim).toBeEnabled();
    await page.screenshot({ path: resolve(directory, "withdrawal-er-outage.png"), fullPage: true });
    await claim.click();
    await verify();
    await expect(page.getByRole("heading", { name: "Withdrawals complete", exact: true })).toBeVisible();
    await expect(claim).toHaveCount(0);
    assert(failures > 0);
    return { erReadFailures: failures, claimReachedWalletDuringOutage: true, closedFromBaseLedger: true };
  } finally { await page.unroute(er, fail); }
}
