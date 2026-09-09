import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, expect } from "@playwright/test";
import { Keypair } from "@solana/web3.js";
import { browserWallet } from "./browser-wallet.ts";
import { checkRoomInvite } from "./room-invite-browser.ts";

const require = createRequire(import.meta.url);
const vitePath = require.resolve("vite", { paths: [dirname(require.resolve("vitest"))] });
const { createServer } = await import(pathToFileURL(vitePath).href);
const directory = resolve(`artifacts/runs/room-navigation-${Date.now()}`);
mkdirSync(directory, { recursive: true });
const server = await createServer({ configFile: false, root: resolve("apps/web"), server: { host: "127.0.0.1", port: 0, watch: { ignored: ["**/.next/**"] } },
  resolve: { alias: { buffer: require.resolve("buffer/", { paths: [dirname(require.resolve("@solana/web3.js"))] }) } },
  optimizeDeps: { entries: ["tests/room-navigation-fixture.tsx"], include: ["buffer"] }, esbuild: { jsx: "automatic" }, css: { postcss: { plugins: [] } },
  plugins: [{ name: "room-navigation-fixture", configureServer(instance: typeof server) {
    instance.middlewares.use("/room-navigation.html", async (_request: unknown, response: { setHeader: (key: string, value: string) => void; end: (body: string) => void }) => {
      response.setHeader("Content-Type", "text/html");
      response.end(await instance.transformIndexHtml("/room-navigation.html", '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Room navigation test</title></head><body><div id="root"></div><script type="module">import { Buffer } from "buffer"; window.Buffer = Buffer; window.process = { env: {} }; await import("/tests/room-navigation-fixture.tsx");</script></body></html>'));
    });
  } }] });
await server.listen();
const address = "8mGLM6MoGgJBfJXAESN5C5fmKXCwnfinDGXX8drPFEie";
const browser = await chromium.launch({ executablePath: process.env.FLINCH_BROWSER_EXECUTABLE });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors: string[] = [];
page.on("pageerror", error => errors.push(error.message));
page.setDefaultTimeout(30_000);
const layouts = [];
try {
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/room-navigation.html`);
  const nav = page.getByRole("navigation", { name: "Room navigation" });
  await expect(nav).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const check = nav.getByRole("button", { name: "Check transaction", exact: true });
  const invite = nav.getByRole("button", { name: "Invite players: copy invite link", exact: true });
  for (const width of [320, 375, 600, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    const bounds = await nav.boundingBox();
    const buttons = await nav.getByRole("button").all();
    let right = 0;
    for (const button of buttons) {
      const box = await button.boundingBox();
      assert(bounds && box && box.width >= 40 && box.height === 44);
      assert(box.x >= right && box.x + box.width <= width - 12, `Controls overlap or overflow at ${width}`);
      assert(box.y - bounds.y >= 6 && bounds.y + bounds.height - box.y - box.height >= 6, "Focus rings need vertical clearance");
      right = box.x + box.width + 8;
      assert.notEqual(await button.evaluate(element => getComputedStyle(element).backgroundColor), "rgba(0, 0, 0, 0)");
    }
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await expect(check).toContainText("Check");
    await nav.screenshot({ path: resolve(directory, `toolbar-${width}.png`) });
    layouts.push({ width, height: bounds!.height, labelsVisible: true, clearButtonSurfaces: true, noOverlap: true });
  }
  await page.setViewportSize({ width: 375, height: 900 });
  await nav.getByRole("button", { name: "Lobby", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(invite).toBeFocused();
  await expect(invite).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Tab");
  await expect(check).toBeFocused();
  const before = await check.boundingBox();
  await page.keyboard.press("Enter");
  await expect(check).toBeDisabled();
  await expect(check).toHaveAttribute("aria-busy", "true");
  assert.deepEqual(await check.boundingBox(), before);
  await check.evaluate(element => { (element as HTMLButtonElement).click(); });
  await expect(page.getByLabel("Checks", { exact: true })).toHaveText("1");
  await page.getByRole("button", { name: "Finish check", exact: true }).click();
  await expect(check).toBeEnabled();
  await check.click();
  await page.getByRole("button", { name: "Fail check", exact: true }).click();
  await expect(check).toBeEnabled();
  for (const toggle of ["Toggle wallet", "Toggle busy"]) {
    await page.getByRole("button", { name: toggle, exact: true }).click();
    await expect(check).toBeDisabled();
    await expect(invite).toBeEnabled();
    await page.getByRole("button", { name: toggle, exact: true }).click();
    await expect(check).toBeEnabled();
  }
  await nav.getByRole("button", { name: "Lobby", exact: true }).click();
  await expect(page.getByLabel("Lobby visits", { exact: true })).toHaveText("1");
  await checkRoomInvite(page, address, directory);
  const production = process.env.FLINCH_UI_URL;
  if (production) {
    assert.equal(new URL(production).hostname, "127.0.0.1");
    const live = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    live.on("pageerror", error => errors.push(error.message));
    await browserWallet(live, Keypair.generate(), () => assert.fail("Room utilities must never sign"));
    await live.goto(`${production}?room=${address}`);
    const liveNav = live.getByRole("navigation", { name: "Room navigation" });
    await expect(liveNav).toBeVisible({ timeout: 30_000 });
    await expect(liveNav.getByRole("button", { name: "Check transaction" })).toBeDisabled();
    await live.getByRole("button", { name: "Connect wallet", exact: true }).click();
    await live.getByRole("button", { name: /FLINCH local test wallet/ }).click();
    await expect(liveNav).toHaveCount(1);
    await liveNav.getByRole("button", { name: "Check transaction" }).click();
    await expect(live.getByText("No saved transaction", { exact: true })).toBeVisible();
    await checkRoomInvite(live, address, directory);
    await expect(liveNav.getByRole("button", { name: "Invite players: copy invite link", exact: true })).toHaveAttribute("data-copied", "false");
    await liveNav.screenshot({ path: resolve(directory, "room-bar-app-1280.png") });
    await liveNav.getByRole("button", { name: "Lobby", exact: true }).click();
    await expect(live.getByRole("button", { name: "Create room", exact: true })).toBeVisible();
    assert.equal(new URL(live.url()).searchParams.has("room"), false);
    await live.close();
  }
  assert.deepEqual(errors, []);
  writeFileSync(resolve(directory, "result.json"), JSON.stringify({ complete: true, layouts, keyboard: true, clipboard: true, manualCopy: true,
    pendingCheckStable: true, duplicateChecksBlocked: true, failedCheckRecovers: true, disconnectedAndBusy: true,
    applicationWiring: !!production, signingAttempted: false, scope: "UI and read-only utility checks, not a funded round", errors }, null, 2));
  console.log(`Room navigation checks passed: ${directory}`);
} catch (error) {
  await page.screenshot({ path: resolve(directory, "failure.png"), fullPage: true });
  console.error(`Room navigation evidence: ${directory}`, errors);
  throw error;
} finally { await browser.close(); await server.close(); }
