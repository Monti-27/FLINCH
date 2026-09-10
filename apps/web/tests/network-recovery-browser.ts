import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";
import { DEVNET_GENESIS } from "../../../packages/client/src/network.ts";
import { roomFixture } from "../../../tests/local/support/room.ts";

const url = new URL(process.env.FLINCH_UI_URL ?? "http://127.0.0.1:3491/play");
assert.equal(url.hostname, "127.0.0.1");
const rpcUrl = "http://127.0.0.1:18991/";
const fixture = await roomFixture();
const ledger = fixture.svm.getAccount(fixture.ledger)!;
const clock = Buffer.alloc(40);
clock.writeBigInt64LE(100n, 32);
const accounts = { context: { slot: 50 }, value: [
  { data: [Buffer.from(ledger.data).toString("base64"), "base64"], owner: ledger.owner.toBase58(), lamports: 1, executable: false, rentEpoch: 0 },
  null,
  { data: [clock.toString("base64"), "base64"], owner: "Sysvar1111111111111111111111111111111111111", lamports: 1, executable: false, rentEpoch: 0 },
] };
url.searchParams.set("room", fixture.ledger.toBase58());
const directory = resolve(`artifacts/runs/network-recovery-${Date.now()}`);
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.FLINCH_BROWSER_EXECUTABLE });
const results: unknown[] = [];
const errors: string[] = [];
const unexpected: string[] = [];
const message = "The network took too long to respond. Retrying automatically.";

try {
  for (const width of [375, 768, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    let navigations = 0;
    page.on("request", request => {
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigations++;
    });
    const methods: string[] = [];
    await context.route("**/*", async route => {
      const request = route.request();
      if (request.url() === rpcUrl && request.method() === "POST") {
        const body = request.postDataJSON();
        methods.push(body.method);
        if (!["getGenesisHash", "getMultipleAccounts"].includes(body.method)) {
          unexpected.push(body.method);
          return route.abort();
        }
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ jsonrpc: "2.0", id: body.id,
          result: body.method === "getGenesisHash" ? DEVNET_GENESIS : accounts }) });
      }
      if (request.url() === new URL("/api/market", url).href) return route.fulfill({ status: 503, body: "Test feed unavailable" });
      if (new URL(request.url()).hostname === "fonts.googleapis.com" && request.resourceType() === "stylesheet") {
        return route.fulfill({ status: 200, contentType: "text/css", body: "" });
      }
      if (new URL(request.url()).origin !== url.origin) {
        unexpected.push(request.url());
        return route.abort();
      }
      return route.continue();
    });
    await page.addInitScript(({ rpcUrl }) => {
      const original = window.fetch.bind(window);
      const state = { genesisAttempts: 0, failNextRoomRead: false, timeouts: 0 };
      Object.assign(window, { networkRecoveryTest: state });
      window.fetch = async (input, init) => {
        const target = input instanceof Request ? input.url : String(input);
        if (target === rpcUrl && init?.body) {
          const { method } = JSON.parse(String(init.body));
          const firstGenesis = method === "getGenesisHash" && ++state.genesisAttempts === 1;
          const roomFailure = method === "getMultipleAccounts" && state.failNextRoomRead;
          if (firstGenesis || roomFailure) {
            state.failNextRoomRead = false;
            const signal = init.signal;
            if (!signal) throw new Error("RPC timeout signal is missing");
            signal.throwIfAborted();
            return new Promise<Response>((_resolve, reject) => signal.addEventListener("abort", () => {
              state.timeouts++;
              reject(signal.reason);
            }, { once: true }));
          }
        }
        return original(input, init);
      };
    }, { rpcUrl });
    await page.goto(url.href, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Room unavailable", exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(message, { exact: true })).toBeVisible();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: resolve(directory, `timeout-${width}.png`), fullPage: true });
    await expect(page.locator(".room-controls")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "Room unavailable", exact: true })).toHaveCount(0);
    await expect(page.getByText(message, { exact: true })).toHaveCount(0);
    await expect(page.locator(".chain-observation")).toContainText("Solana state confirmed at slot 50.");
    await expect.poll(() => methods.filter(method => method === "getMultipleAccounts").length).toBeGreaterThan(1);
    if (width === 1280) {
      const controls = await page.locator(".room-controls").elementHandle();
      await page.evaluate(() => Object.assign(Reflect.get(window, "networkRecoveryTest"), { failNextRoomRead: true }));
      await expect(page.getByRole("status").filter({ hasText: message })).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole("heading", { name: "Room unavailable", exact: true })).toHaveCount(0);
      assert(await controls!.evaluate(element => element.isConnected));
      await page.screenshot({ path: resolve(directory, "refresh-timeout-1280.png"), fullPage: true });
      await expect(page.getByText(message, { exact: false })).toHaveCount(0);
      assert(await controls!.evaluate(element => element.isConnected));
      await controls!.dispose();
    }
    assert.equal(navigations, 1, "Recovery must not reload the page");
    const state = await page.evaluate(() => Reflect.get(window, "networkRecoveryTest"));
    assert.equal(state.genesisAttempts, 2);
    assert.equal(state.timeouts, width === 1280 ? 2 : 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: resolve(directory, `recovered-${width}.png`), fullPage: true });
    results.push({ width, navigations, state, methods });
    await context.close();
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(unexpected, []);
  writeFileSync(resolve(directory, "result.json"), JSON.stringify({ complete: true, fixtureAccounts: true,
    realFiveSecondTimeout: true, noLiveRpc: true, noWalletConnected: true, noTransactions: true, results }, null, 2));
  console.log(`Network recovery browser checks passed: ${directory}`);
} catch (error) {
  console.error(`Network recovery evidence: ${directory}`);
  for (const context of browser.contexts()) for (const page of context.pages()) {
    await page.screenshot({ path: resolve(directory, "failure.png"), fullPage: true }).catch(() => {});
  }
  throw error;
} finally { await browser.close(); }
