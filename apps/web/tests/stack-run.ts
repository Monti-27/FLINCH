import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { openSync, closeSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { NATIVE_MINT, createAssociatedTokenAccountIdempotentInstruction, createSyncNativeInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { startStack } from "../../../tests/stack/bootstrap.ts";
import { localClient, sendClient, captureTransaction } from "../../../tests/stack/client.ts";
import { poll } from "../../../tests/stack/rpc.ts";
import { journal, result, snapshot } from "../../../tests/stack/evidence.ts";
import { stopChild, requireFreePorts } from "../../../tests/stack/process.ts";
import { queueQuotedBatch } from "../../../tests/stack/quoted-batch.ts";
import { USDC_MINT, vaults } from "@flinch/client";
import { browserWallet } from "./browser-wallet.ts";
import { settlePlayerRail } from "./player-rail-browser.ts";
import { checkRoomReadRecovery } from "./room-recovery-browser.ts";
import { startBrowserKeeper } from "./browser-keeper.ts";
import { checkWithdrawal, claimWithoutEr, createApprovalGate } from "./withdrawal-browser.ts";

await requireFreePorts([3300]);
const stack = await startStack();
const client = await localClient(stack);
const browser = await chromium.launch({ executablePath: process.env.FLINCH_BROWSER_EXECUTABLE });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultTimeout(20_000);
page.setDefaultNavigationTimeout(20_000);
const errors: string[] = [];
page.on("pageerror", error => errors.push(error.message));
page.on("console", message => { if (message.type() === "error") journal(stack.directory, "browser-errors", { text: message.text() }); });
const walletSignatures: string[] = [];
const approval = createApprovalGate();
await browserWallet(page, stack.host, signature => { walletSignatures.push(signature); journal(stack.directory, "browser-signatures", { signature }); }, approval.beforeSign);
const log = openSync(resolve(stack.directory, "web.log"), "a", 0o600);
const web = spawn(process.execPath, [resolve("apps/web/node_modules/next/dist/bin/next"), "dev", "--webpack", "--hostname", "127.0.0.1", "--port", "3300"], {
  cwd: resolve("apps/web"), stdio: ["ignore", log, log], env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1",
    NEXT_PUBLIC_FLINCH_NETWORK: "localnet", NEXT_PUBLIC_FLINCH_BASE_RPC: stack.base.rpcEndpoint,
    NEXT_PUBLIC_FLINCH_LOCAL_ER: stack.er.rpcEndpoint, NEXT_PUBLIC_FLINCH_GENESIS: await stack.base.getGenesisHash(),
    NEXT_PUBLIC_FLINCH_ENABLE_TRANSACTIONS: "true", NEXT_PUBLIC_FLINCH_POOL: stack.pool.pool.toBase58(),
    NEXT_PUBLIC_FLINCH_VALIDATOR: (await stack.er.getClosestValidator()).identity }
});
closeSync(log);
console.log(`Browser evidence: ${stack.directory}`);
let keeperService: Awaited<ReturnType<typeof startBrowserKeeper>> | undefined;
try {
  await poll("web startup", async () => (await fetch("http://127.0.0.1:3300", { signal: AbortSignal.timeout(1500) })).ok ? true : undefined, 60_000, true);
  await page.goto("http://127.0.0.1:3300/play");
  await page.getByRole("button", { name: "Connect wallet", exact: true }).click();
  await page.getByRole("button", { name: /FLINCH local test wallet/ }).click();
  await expect(page.getByRole("button", { name: "Create room", exact: true })).toBeEnabled();
  await page.screenshot({ path: resolve(stack.directory, "lobby-desktop.png"), fullPage: true });
  await page.getByRole("button", { name: "Create room", exact: true }).click();
  await page.waitForURL(/room=/);
  const ledger = new PublicKey(new URL(page.url()).searchParams.get("room")!);
  console.log("Browser created room");
  await page.getByRole("button", { name: "Join · 0.001 SOL", exact: true }).click();
  await poll("browser stake and session bind", async () => {
    const state = await client.readRoom(ledger);
    return state.ledger.wallets[0].equals(stack.host.publicKey) && !state.ledger.sessionSigners[0].equals(PublicKey.default) ? true : undefined;
  });
  console.log("Browser joined and bound session");
  await page.screenshot({ path: resolve(stack.directory, "funding-desktop.png"), fullPage: true });
  await settlePlayerRail(page, true);
  await expect(page.locator(".roster-seat")).toHaveCount(1);
  await expect(page.getByRole("button", { name: /Player 2, open seat/ })).toBeVisible();
  const signedBeforeSlot = walletSignatures.length;
  await page.getByRole("button", { name: /Player 2, open seat/ }).click();
  await expect(page.locator(".room-controls")).toBeFocused();
  assert.equal(walletSignatures.length, signedBeforeSlot, "A player slot must not submit a transaction");
  const bots = Array.from({ length: 3 }, () => Keypair.generate());
  await sendClient(stack, stack.base, bots.map(bot => SystemProgram.transfer({ fromPubkey: stack.host.publicKey, toPubkey: bot.publicKey, lamports: 100_000_000n })), [stack.host], "fund local browser opponents");
  for (const bot of bots) {
    const ata = getAssociatedTokenAddressSync(NATIVE_MINT, bot.publicKey);
    await sendClient(stack, stack.base, [createAssociatedTokenAccountIdempotentInstruction(bot.publicKey, ata, bot.publicKey, NATIVE_MINT),
      SystemProgram.transfer({ fromPubkey: bot.publicKey, toPubkey: ata, lamports: 1_000_000n }), createSyncNativeInstruction(ata), await client.instructions.join(ledger, bot.publicKey)], [bot], "bot joins browser room");
  }
  await page.getByRole("button", { name: "Start round", exact: true }).click();
  console.log("Browser started round");
  keeperService = await startBrowserKeeper(stack, ledger);
  await poll("browser room live", async () => { keeperService!.check(); const state = await client.readRoom(ledger); return state.control.kind === "delegated" ? true : undefined; });
  await expect(page.getByRole("button", { name: "Get sell quote", exact: true })).toBeEnabled();
  await page.setViewportSize({ width: 1280, height: 1280 });
  await expect(page.locator(".roster-seat")).toHaveCount(4);
  await expect(page.locator(".player-slot")).toHaveCount(0);
  await settlePlayerRail(page, true);
  await page.screenshot({ path: resolve(stack.directory, "players-funded-desktop.png"), fullPage: true });
  for (const width of [1280, 768, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: resolve(stack.directory, `active-${width}.png`), fullPage: true });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `Active room overflow at ${width}`);
    const quoteButton = await page.getByRole("button", { name: "Get sell quote", exact: true }).boundingBox();
    assert(quoteButton && quoteButton.y + quoteButton.height <= 900, `SELL quote is below the first viewport at ${width}`);
    assert(await page.getByRole("button", { name: "Get sell quote", exact: true }).evaluate(button => {
      const bounds = button.getBoundingClientRect();
      const hit = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      return !!hit && button.contains(hit);
    }), `Another surface covers SELL at ${width}`);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  const readRecovery = await checkRoomReadRecovery(page, stack.base.rpcEndpoint, stack.er.rpcEndpoint, stack.directory);
  const signaturesBeforeQuote = walletSignatures.length;
  await page.getByRole("button", { name: "Get sell quote", exact: true }).click();
  await expect(page.getByRole("button", { name: "Queue SELL · session key", exact: true })).toBeVisible();
  await expect(page.getByText("Quote expired; refresh before signing", { exact: true })).toBeVisible({ timeout: 4000 });
  await expect(page.getByRole("button", { name: "Queue SELL · session key", exact: true })).toBeDisabled({ timeout: 4000 });
  assert.equal(walletSignatures.length, signaturesBeforeQuote, "Reading and expiring a quote must never ask the wallet to sign");
  assert.equal((await client.resolve(await client.readRoom(ledger))).control.sellers, 0, "An expired quote must not create an intent");
  await page.screenshot({ path: resolve(stack.directory, "quote-expired.png"), fullPage: true });
  await page.getByRole("button", { name: "Refresh quote", exact: true }).click();
  await page.getByRole("button", { name: "Queue SELL · session key", exact: true }).click();
  await poll("browser session intent", async () => {
    const state = await client.resolve(await client.readRoom(ledger));
    return state.control.sellers === 1 ? true : undefined;
  });
  console.log("Browser session queued SELL");
  await expect(page.getByRole("heading", { name: "Sell queued", exact: true })).toBeVisible();
  await page.screenshot({ path: resolve(stack.directory, "queued-desktop.png"), fullPage: true });
  const erSignature = await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith("flinch:v2:"))
    .map(key => JSON.parse(localStorage.getItem(key)!)).find(op => op.runtime === "er")?.signature as string | undefined);
  assert(erSignature);
  await captureTransaction(stack, stack.er, erSignature, "browser session SELL");
  await page.reload();
  await page.getByRole("button", { name: "Check transaction", exact: true }).click();
  await poll("browser sale settles", async () => { keeperService!.check(); return (await client.readRoom(ledger)).ledger.economics!.revision === 1n ? true : undefined; });
  const expectedClaim = (await client.readRoom(ledger)).ledger.economics!.usdcClaims[0];
  await expect(page.getByRole("button", { name: "Claim USDC", exact: true })).toBeEnabled();
  const withdrawal = await checkWithdrawal(page, stack.directory, expectedClaim, approval, walletSignatures);
  assert.equal((await client.readRoom(ledger)).ledger.economics!.usdcClaims[0], expectedClaim);
  await page.screenshot({ path: resolve(stack.directory, "claimable-desktop.png"), fullPage: true });
  const destination = getAssociatedTokenAddressSync(USDC_MINT, stack.host.publicKey);
  const withdrawalOutage = await claimWithoutEr(page, stack.er.rpcEndpoint, stack.directory, async () => {
    await poll("browser claim reaches wallet", async () => {
      const account = await stack.base.getAccountInfo(destination);
      return account && BigInt((await stack.base.getTokenAccountBalance(destination)).value.amount) > 0n ? true : undefined;
    });
    assert.equal(BigInt((await stack.base.getTokenAccountBalance(destination)).value.amount), expectedClaim);
  });
  await poll("second browser cohort ready", async () => { keeperService!.check(); const state = await client.readRoom(ledger); return state.control.kind === "delegated" ? true : undefined; });
  await queueQuotedBatch(stack, client, ledger, [1, 2], bots.slice(0, 2));
  await poll("browser room terminal", async () => { keeperService!.check(); return (await client.readRoom(ledger)).ledger.economics!.terminalTag === 1 ? true : undefined; });
  const terminal = (await client.readRoom(ledger)).ledger.economics!;
  assert.equal(terminal.terminalSeat, 3);
  for (let index = 0; index < 3; index++) {
    const asset = index === 2 ? "wsol" : "usdc";
    const mint = asset === "wsol" ? NATIVE_MINT : USDC_MINT;
    const ata = getAssociatedTokenAddressSync(mint, bots[index].publicKey);
    await sendClient(stack, stack.base, [createAssociatedTokenAccountIdempotentInstruction(bots[index].publicKey, ata, bots[index].publicKey, mint),
      await client.instructions.claim(ledger, bots[index].publicKey, asset)], [bots[index]], "browser opponent claim");
  }
  await page.getByText("Room & session controls", { exact: true }).click();
  await page.getByRole("button", { name: "Stop session and request revocation", exact: true }).click();
  await expect(page.locator('[data-sonner-toast][data-type="success"]').filter({ hasText: "Session revocation recorded" })).toBeVisible();
  await page.getByText("Room & session controls", { exact: true }).click();
  for (const width of [1280, 768, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: resolve(stack.directory, `room-${width}.png`), fullPage: true });
    const overflowing = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>("body *")]
      .filter(element => element.getBoundingClientRect().right > window.innerWidth && element.getClientRects().length > 0)
      .map(element => ({ tag: element.tagName, className: element.className, right: element.getBoundingClientRect().right })));
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `horizontal overflow at ${width}: ${JSON.stringify(overflowing)}`);
  }
  assert.deepEqual(errors, []);
  const custody = vaults(ledger);
  assert.equal((await stack.base.getTokenAccountBalance(custody.wsolVault)).value.amount, "0");
  assert.equal((await stack.base.getTokenAccountBalance(custody.usdcVault)).value.amount, "0");
  for (const signature of walletSignatures) await captureTransaction(stack, stack.base, signature, "browser wallet action");
  await keeperService.capture();
  journal(stack.directory, "browser-final", { ledger: ledger.toBase58(), accounts: await snapshot(stack.base, [ledger, destination, ...Object.values(custody)]) });
  result(stack.directory, { complete: true, environment: "local browser and MagicBlock", syntheticLiquidity: true, controlInjected: false,
    wallet: "test Wallet Standard adapter signing real local transactions", keeper: "standalone process with independent fee payer", keeperPid: keeperService.pid,
    swaps: 2, claims: 4, browserReloads: 1, baseRevocationAfterReload: true, readRecovery, withdrawal, withdrawalOutage,
    quoteExpiry: { disabledBeforeRefresh: true, noAutomaticSigning: true, noAutomaticIntent: true, deliberateRefresh: true }, ledger: ledger.toBase58() });
  console.log("Browser round completed with two swaps, four claims, and a reload after SELL.");
} catch (error) {
  await page.screenshot({ path: resolve(stack.directory, "browser-failure.png"), fullPage: true });
  journal(stack.directory, "browser-failure", { error: String(error), pageErrors: errors, text: await page.locator("body").innerText() });
  result(stack.directory, { complete: false, environment: "local browser and MagicBlock", error: String(error) });
  throw error;
} finally { await browser.close(); await keeperService?.stop(); await stopChild(web); await stack.stop(); }
