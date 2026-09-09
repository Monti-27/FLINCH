import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, NATIVE_MINT } from "@solana/spl-token";
import { FlinchClient, connection, transactionStatus, USDC_MINT, vaults } from "@flinch/client";
import { probeDevnet } from "../../../tools/devnet/probe.ts";
import { readKey, writePrivate } from "../../../tools/devnet/private-files.ts";
import { capture, json, record, waitFor } from "../../../tools/devnet/operations.ts";
import { FileOperationStore } from "../../keeper/src/file-store.ts";
import { readConfig } from "../../keeper/src/runtime/config.ts";
import { browserWallet } from "./browser-wallet.ts";
import type { Operation } from "../src/lib/operation.ts";

const args = process.argv.slice(2);
assert((args.length === 3 || args.length === 4 && args[3] === "--hosted") && args[0] === "--directory" && args[2] === "--execute-devnet", "Explicit devnet execution is required");
const hosted = args[3] === "--hosted";
const origin = hosted ? "https://flinch-game.up.railway.app" : "http://127.0.0.1:3500";
if (hosted) {
  const web = await (await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(10000) })).json();
  const keeper = await (await fetch("https://flinch-keeper.up.railway.app/health", { signal: AbortSignal.timeout(10000) })).json();
  assert(web.healthy && web.network === "devnet" && web.transactionsEnabled && web.backend === "connected" && web.database === "connected");
  assert(keeper.healthy && keeper.network === "devnet" && keeper.transactionsEnabled && keeper.keeper === "running");
}
const directory = resolve(args[1]);
const preflight = await probeDevnet(directory);
assert(preflight.deployed);
const client = new FlinchClient({ network: "devnet", baseUrl: preflight.baseUrl, expectedGenesis: preflight.genesis });
const players = await Promise.all([0, 1, 2, 3].map(seat => readKey(resolve(directory, `player-${seat}.json`))));
const evidence = await mkdtemp(resolve("artifacts/runs/devnet-browser-"));
const browser = await chromium.launch({ executablePath: process.env.FLINCH_BROWSER_EXECUTABLE });
const signatures: { seat: number; signature: string; runtime: "base" | "er" }[] = [];
const errors: string[] = [];
const discarded = new Set<string>();
const pages: Page[] = [];
let rejectNext = false;
let runtime: "base" | "er" = "base";
let ledger: PublicKey | undefined;
let erUrl: string | undefined;
console.log(`Devnet browser evidence: ${evidence}`);

async function operations(page: Page) {
  return page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith("flinch:v2:"))
    .map(key => JSON.parse(localStorage.getItem(key)!) as Operation));
}

async function freshCohort() {
  return waitFor("open devnet cohort", async () => {
    const room = await client.readRoom(ledger!);
    if (room.control.kind !== "delegated") return;
    try {
      const er = await client.resolve(room);
      if (er.control.phase === "live" && er.control.sellers === 0 && (er.now - er.control.startedAt) % 2n === 0n) return er;
    } catch (error) { if (!(error instanceof Error) || !("code" in error) || error.code !== "placement_pending") throw error; }
  });
}

async function queueBrowser(page: Page, seat: number) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const expired = page.locator('[data-sonner-toast][data-front="true"][data-removed="false"][data-type="warning"]').filter({ hasText: "Quote expired" });
    if (await expired.isVisible()) {
      await expired.getByRole("button", { name: "Close toast", exact: true }).click();
      await expect(expired).not.toBeVisible();
    }
    await freshCohort();
    const existing = (await operations(page)).find(item => item.runtime === "er");
    assert(!existing || existing.status === "not_sent", "An existing submitted sell must be reconciled, not retried");
    const signedBefore = signatures.length;
    const quote = page.getByRole("button", { name: /^(Get sell quote|Refresh quote)$/ });
    await expect(quote).toBeEnabled();
    await quote.click();
    await page.getByRole("button", { name: `Queue SELL · ${seat === 1 ? "wallet approval" : "session key"}`, exact: true }).click();
    const outcome = await waitFor("browser sell outcome", async () => {
      const op = (await operations(page)).find(item => item.runtime === "er");
      if (op && op.signature !== existing?.signature) {
        if (op.status === "not_sent") return { op, notSubmitted: true };
        const status = await transactionStatus(connection(op.endpoint, "devnet"), op.signature);
        assert.notEqual(status.kind, "failed", "Browser sell failed onchain");
        if (status.kind === "confirmed") return { op, notSubmitted: false };
        return;
      }
      if (await expired.isVisible() && await page.getByRole("button", { name: "Refresh quote", exact: true }).isEnabled())
        return { op: undefined, notSubmitted: true };
    });
    await record(evidence, { event: "browser-sell-outcome", seat, attempt, ...outcome });
    if (!outcome.notSubmitted && outcome.op) return outcome.op;
    for (const item of signatures.slice(signedBefore)) discarded.add(item.signature);
  }
  throw new Error("Browser sell did not obtain a usable fresh quote");
}

try {
  for (let seat = 0; seat < 4; seat++) {
    const context = await browser.newContext({ viewport: { width: seat === 1 ? 375 : 1280, height: 900 } });
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    page.on("pageerror", error => errors.push(error.message));
    await browserWallet(page, players[seat], signature => { signatures.push({ seat, signature, runtime }); }, async () => {
      if (rejectNext) { rejectNext = false; throw Object.assign(new Error("User rejected the request"), { code: 4001 }); }
    });
    await page.goto(`${origin}/play`);
    await page.getByRole("button", { name: "Connect wallet", exact: true }).click();
    await page.getByRole("button", { name: /FLINCH local test wallet/ }).click();
    await expect(page.getByRole("button", { name: "Create room", exact: true })).toBeEnabled();
    pages.push(page);
  }
  rejectNext = true;
  await pages[0].getByRole("button", { name: "Create room", exact: true }).click();
  await expect(pages[0].locator("[data-sonner-toast]").filter({ hasText: "Request cancelled" })).toBeVisible();
  assert.equal(signatures.length, 0);
  assert.equal((await operations(pages[0])).length, 0);
  await pages[0].getByRole("button", { name: "Create room", exact: true }).click();
  await pages[0].waitForURL(/room=/);
  ledger = new PublicKey(new URL(pages[0].url()).searchParams.get("room")!);
  await record(evidence, { event: "round-plan", ledger, players: players.map(player => player.publicKey), stake: 1_000_000n });
  for (let seat = 0; seat < 4; seat++) {
    if (seat) await pages[seat].goto(pages[0].url());
    await pages[seat].getByRole("button", { name: "Join · 0.001 SOL", exact: true }).click();
    await waitFor("confirmed browser deposit", async () => {
      const room = await client.readRoom(ledger!);
      return room.ledger.wallets[seat].equals(players[seat].publicKey) && !room.ledger.sessionSigners[seat].equals(PublicKey.default) ? true : undefined;
    });
  }
  const er = await freshCohort();
  erUrl = er.connection.rpcEndpoint;
  await record(evidence, { event: "live-placement", placement: er.placement, control: er.control, ledger: (await client.readRoom(ledger)).ledger });
  await expect(pages[0].getByRole("button", { name: "Get sell quote", exact: true })).toBeEnabled();
  await pages[0].screenshot({ path: resolve(evidence, "active-desktop.png"), fullPage: true });
  const beforeExpiry = signatures.length;
  await pages[0].getByRole("button", { name: "Get sell quote", exact: true }).click();
  await expect(pages[0].getByText("Quote expired; refresh before signing", { exact: true })).toBeVisible({ timeout: 5000 });
  await expect(pages[0].getByRole("button", { name: "Queue SELL · session key", exact: true })).toBeDisabled();
  assert.equal(signatures.length, beforeExpiry);
  for (const seat of [0, 1, 2]) {
    const page = pages[seat];
    if (seat === 1) await page.reload();
    runtime = "er";
    const op = await queueBrowser(page, seat);
    assert.equal(op.endpoint, erUrl);
    await capture(evidence, connection(op.endpoint, "devnet"), op.signature, `browser-sell-${seat}`);
    const settled = await waitFor("confirmed browser sale", async () => {
      const room = await client.readRoom(ledger!);
      return room.ledger.economics?.revision === BigInt(seat + 1) ? room : undefined;
    });
    const expected = settled.ledger.economics!.usdcClaims[seat];
    assert(expected > 0n);
    runtime = "base";
    if (seat === 0) await page.reload();
    await expect(page.getByRole("button", { name: "Claim USDC", exact: true })).toBeEnabled();
    const destination = getAssociatedTokenAddressSync(USDC_MINT, players[seat].publicKey);
    const before = BigInt((await client.base.getTokenAccountBalance(destination)).value.amount);
    if (seat === 0) {
      const beforeCancel: number = signatures.length;
      rejectNext = true;
      await page.getByRole("button", { name: "Claim USDC", exact: true }).click();
      await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Request cancelled" })).toBeVisible();
      assert.equal(signatures.length, beforeCancel);
      assert.equal((await client.readRoom(ledger)).ledger.economics!.usdcClaims[seat], expected);
      await page.route(`${erUrl}**`, route => route.fulfill({ status: 503, body: "Test client ER read outage" }));
    }
    await page.getByRole("button", { name: "Claim USDC", exact: true }).click();
    const after = await waitFor("browser USDC withdrawal", async () => {
      const amount = BigInt((await client.base.getTokenAccountBalance(destination)).value.amount);
      return amount - before === expected ? amount : undefined;
    });
    if (seat === 0) await page.unroute(`${erUrl}**`);
    await record(evidence, { event: "browser-claim", seat, asset: "usdc", before, after, expected });
    await page.screenshot({ path: resolve(evidence, `player-${seat}-claimed.png`), fullPage: true });
  }
  const terminal = (await client.readRoom(ledger)).ledger.economics!;
  assert.equal(terminal.terminalTag, 1);
  assert.equal(terminal.terminalSeat, 3);
  const destination = getAssociatedTokenAddressSync(NATIVE_MINT, players[3].publicKey);
  const before = BigInt((await client.base.getTokenAccountBalance(destination)).value.amount);
  await pages[3].getByRole("button", { name: "Claim WSOL", exact: true }).click();
  const after = await waitFor("browser holder withdrawal", async () => {
    const amount = BigInt((await client.base.getTokenAccountBalance(destination)).value.amount);
    return amount - before === terminal.holdings[3] ? amount : undefined;
  });
  await record(evidence, { event: "browser-claim", seat: 3, asset: "wsol", before, after, expected: terminal.holdings[3] });
  for (const page of pages) {
    await page.getByText("Room & session controls", { exact: true }).click();
    await page.getByRole("button", { name: "Stop session and request revocation", exact: true }).click();
    await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Session revocation recorded" })).toBeVisible();
  }
  for (const item of signatures.filter(item => !discarded.has(item.signature)))
    await capture(evidence, item.runtime === "base" ? client.base : connection(erUrl, "devnet"), item.signature, `wallet-${item.seat}`);
  const config = await readConfig(resolve(directory, "keeper-config.json"));
  const history = hosted ? [] : await new FileOperationStore(config.journalDirectory).history(ledger.toBase58());
  for (const op of new Map(history.map(op => [op.signature, op])).values()) {
    await capture(evidence, op.runtime === "base" ? client.base : connection(op.endpoint, "devnet"), op.signature, `keeper-${op.action}`);
    if (op.returnSignature) await capture(evidence, client.base, op.returnSignature, "base-return");
  }
  for (const address of Object.values(vaults(ledger))) assert.equal((await client.base.getTokenAccountBalance(address)).value.amount, "0");
  assert.deepEqual(errors, []);
  await pages[3].screenshot({ path: resolve(evidence, "complete-desktop.png"), fullPage: true });
  await writePrivate(resolve(evidence, "result.json"), json({ complete: true, network: "devnet", origin, hosted, ledger, swaps: 3, claims: 4,
    syntheticLiquidity: false, wallet: "four synthetic Wallet Standard adapters", ordinaryExtensionsVerified: false,
    depositsAndClaimsThroughUi: true, sessionAndWalletSell: true, reload: true, rejectedCreateAndClaim: true,
    quoteExpiry: true, claimDuringClientErOutage: true, revocations: 4 }));
  console.log(`Devnet browser round complete: ${evidence}`);
} catch (error) {
  await record(evidence, { event: "browser-stopped", ledger, error: error instanceof Error ? error.message : "unknown", pageErrors: errors,
    signatures, operations: await Promise.all(pages.map(page => operations(page))), text: await Promise.all(pages.map(page => page.locator("body").innerText())) });
  for (const [seat, page] of pages.entries()) await page.screenshot({ path: resolve(evidence, `failure-${seat}.png`), fullPage: true }).catch(() => undefined);
  throw error;
} finally { await browser.close(); }
