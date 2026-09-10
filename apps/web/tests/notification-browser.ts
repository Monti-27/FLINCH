import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Connection, PublicKey } from "@solana/web3.js";
import { chromium, expect } from "@playwright/test";

const url = process.env.FLINCH_UI_URL ?? "http://127.0.0.1:3400/play";
const baseUrl = process.env.FLINCH_BASE_URL ?? "http://127.0.0.1:18899";
assert.equal(new URL(url).hostname, "127.0.0.1");
assert.equal(new URL(baseUrl).hostname, "127.0.0.1");
assert(process.env.FLINCH_TEST_WALLET, "Supply an existing local public wallet address; no secret key is used");
const publicKey = new PublicKey(process.env.FLINCH_TEST_WALLET);
const base = new Connection(baseUrl, "confirmed");
const before = await base.getBalance(publicKey);
assert(before > 0, "The read-only preview requires an existing funded local account");
const directory = resolve(`artifacts/runs/notification-ux-${Date.now()}`);
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.FLINCH_BROWSER_EXECUTABLE });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultTimeout(20_000);
let requested = 0;
let rejected = { code: 4001, message: "User rejected the request." };
const blocked: string[] = [];
const pageErrors: string[] = [];
page.on("pageerror", error => pageErrors.push(error.message));
await page.route("**/*", async route => {
  const request = route.request();
  if (request.method() === "POST") {
    const body = request.postDataJSON();
    const calls = Array.isArray(body) ? body : [body];
    for (const call of calls) {
      if (typeof call?.method === "string" && !/^(get\w+|simulateTransaction)$/.test(call.method)) {
        blocked.push(call.method);
        return route.abort("blockedbyclient");
      }
    }
  }
  await route.continue();
});
await page.exposeFunction("flinchTestReject", () => { requested++; return rejected; });
await page.addInitScript(({ address, bytes }) => {
  const account = { address, publicKey: new Uint8Array(bytes), chains: ["solana:devnet"], features: ["solana:signTransaction"] };
  const listeners = new Set<(event: unknown) => void>();
  const wallet = { version: "1.0.0", name: "FLINCH cancellation test wallet",
    icon: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=",
    chains: ["solana:devnet"], accounts: [] as unknown[], features: {
      "standard:connect": { version: "1.0.0", connect: async () => {
        wallet.accounts = [account]; listeners.forEach(listener => listener({ accounts: [account] })); return { accounts: [account] };
      } },
      "standard:disconnect": { version: "1.0.0", disconnect: async () => {
        wallet.accounts = []; listeners.forEach(listener => listener({ accounts: [] }));
      } },
      "standard:events": { version: "1.0.0", on: (_event: string, listener: (event: unknown) => void) => {
        listeners.add(listener); return () => listeners.delete(listener);
      } },
      "solana:signTransaction": { version: "1.0.0", supportedTransactionVersions: ["legacy", 0], signTransaction: async () => {
        const reject = (window as unknown as { flinchTestReject: () => Promise<unknown> }).flinchTestReject;
        throw await reject();
      } },
    } };
  const register = (api: { register: (wallet: unknown) => void }) => api.register(wallet);
  window.addEventListener("wallet-standard:app-ready", event => register((event as CustomEvent).detail));
  window.dispatchEvent(new CustomEvent("wallet-standard:register-wallet", { detail: register }));
}, { address: publicKey.toBase58(), bytes: Array.from(publicKey.toBytes()) });

try {
  await page.goto(url);
  await page.getByRole("button", { name: "Connect wallet", exact: true }).click();
  await page.getByRole("button", { name: /FLINCH cancellation test wallet/ }).click();
  const create = page.getByRole("button", { name: "Create room", exact: true });
  const input = page.getByLabel("Stake per player, in SOL");
  await expect(create).toBeEnabled();
  const measurements = [];
  for (const width of [1280, 768, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await input.fill("0.001");
    const previous = requested;
    await create.click();
    const toast = page.locator('[data-sonner-toast][data-type="info"]').filter({ hasText: "Request cancelled" });
    await expect(toast).toBeVisible();
    await expect(toast).toContainText("This request wasn't submitted.");
    await expect.poll(() => requested).toBe(previous + 1);
    await expect(page.locator('[data-sonner-toast]:not([data-removed="true"])')).toHaveCount(1);
    await expect(page.locator("main [role=alert], .transaction-panel")).toHaveCount(0);
    await expect(page.getByText("User rejected the request.", { exact: true })).toHaveCount(0);
    await expect(input).toHaveValue("0.001");
    await expect(input).toHaveAttribute("aria-invalid", "false");
    await expect(create).toBeEnabled();
    assert(!new URL(page.url()).searchParams.has("room"));
    await expect(toast).toHaveAttribute("data-mounted", "true");
    const gutter = width < 600 ? 16 : 24;
    await expect.poll(() => toast.evaluate(element => Math.round(innerHeight - element.getBoundingClientRect().bottom))).toBe(gutter);
    const metrics = await toast.evaluate(element => {
      const box = element.getBoundingClientRect();
      return { right: innerWidth - box.right, bottom: innerHeight - box.bottom, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    assert.equal(metrics.overflow, false);
    assert.equal(Math.round(metrics.bottom), gutter);
    assert.equal(metrics.right, gutter);
    measurements.push({ width, ...metrics });
    await page.screenshot({ path: resolve(directory, `cancelled-${width}.png`) });
    await toast.getByRole("button", { name: "Close toast", exact: true }).click();
    await expect(toast).toHaveCount(0);
  }
  rejected = { code: -32603, message: "Signer changed the transaction message" };
  await create.click();
  const failure = page.locator('[data-sonner-toast][data-type="error"]');
  await expect(failure).toContainText("Wallet request changed");
  await expect(page.locator("main [role=alert], .transaction-panel")).toHaveCount(0);
  await failure.getByRole("button", { name: "Close toast", exact: true }).click();
  await expect(failure).toHaveCount(0);
  await page.getByRole("button", { name: "Have a room code?", exact: true }).click();
  const invite = page.getByLabel("Room address or invite link", { exact: true });
  await invite.fill("invalid-room");
  await page.getByRole("button", { name: "Open room", exact: true }).click();
  await expect(page.locator('[data-sonner-toast][data-type="warning"]')).toContainText("Check the room link");
  await expect(invite).toBeFocused();
  await expect(invite).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("main [role=alert]")).toHaveCount(0);
  assert.deepEqual(blocked, []);
  assert.deepEqual(pageErrors, []);
  const after = await base.getBalance(publicKey);
  assert.equal(after, before);
  assert.equal(await page.evaluate(() => Object.keys(localStorage).some(key => key.startsWith("flinch:v2:"))), false);
  writeFileSync(resolve(directory, "result.json"), JSON.stringify({ complete: true, readOnly: true, testWalletAlwaysRejects: true,
    signatures: 0, submittedTransactions: 0, requested, blocked, before, after, measurements, pageErrors }, null, 2));
  console.log(`Notification UX passed: ${directory}`);
} catch (error) {
  await page.screenshot({ path: resolve(directory, "failure.png"), fullPage: true });
  console.error(`Notification evidence: ${directory}`);
  throw error;
} finally { await browser.close(); }
