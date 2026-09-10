import assert from "node:assert/strict";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";
import { Keypair, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, NATIVE_MINT } from "@solana/spl-token";
import { connection, FlinchClient, formatUnits, LocalPlacementResolver, USDC_MINT, vaults } from "@flinch/client";
import { FileOperationStore } from "../../keeper/src/index.ts";
import { startLocalProcess } from "../../../tests/stack/local-process.ts";
import { captureTransaction } from "../../../tests/stack/client.ts";
import { journal, result, snapshot } from "../../../tests/stack/evidence.ts";
import { poll } from "../../../tests/stack/rpc.ts";
import { browserWallet } from "./browser-wallet.ts";
import { checkRoomInvite } from "./room-invite-browser.ts";

const sandbox = startLocalProcess();
const browser = await chromium.launch({ executablePath: process.env.FLINCH_BROWSER_EXECUTABLE });
let directory: string | undefined;
try {
  const info = await sandbox.ready();
  directory = info.evidence;
  console.log(`Four-browser local play evidence: ${directory}`);
  const base = connection(info.baseRpc, "localnet");
  const er = connection(info.erRpc, "localnet");
  const client = new FlinchClient({ network: "localnet", baseUrl: info.baseRpc, expectedGenesis: info.genesis }, new LocalPlacementResolver(base, info.erRpc));
  const wallets = Array.from({ length: 4 }, () => Keypair.generate());
  const signatures: string[] = [];
  const pageErrors: string[] = [];
  const pages = [];
  for (const [index, wallet] of wallets.entries()) {
    const grant = await sandbox.command(`fund ${wallet.publicKey}`, "funding");
    assert.equal(grant.status, "confirmed");
    assert.equal(await base.getBalance(wallet.publicKey, "confirmed"), 1_000_000_000);
    if (index === 0) {
      const repeated = await sandbox.command(`fund ${wallet.publicKey}`, "funding");
      assert.equal(repeated.signature, grant.signature);
      assert.equal(repeated.repeated, true);
      assert.equal(await base.getBalance(wallet.publicKey, "confirmed"), 1_000_000_000);
    }
    const context = await browser.newContext({ viewport: { width: index === 1 ? 375 : 1280, height: 900 } });
    const page = await context.newPage();
    page.setDefaultTimeout(20_000);
    page.on("pageerror", error => pageErrors.push(error.message));
    await browserWallet(page, wallet, signature => { signatures.push(signature); journal(info.evidence, "local-player-signatures", { seat: index, signature }); });
    await page.goto(info.url);
    await page.getByRole("button", { name: "Connect wallet", exact: true }).click();
    await page.getByRole("button", { name: /FLINCH local test wallet/ }).click();
    pages.push(page);
  }
  await pages[0].getByRole("button", { name: "Create room", exact: true }).click();
  await pages[0].waitForURL(/room=/);
  const roomUrl = pages[0].url();
  const ledger = new PublicKey(new URL(roomUrl).searchParams.get("room")!);
  const beforeSharing = signatures.length;
  const inviteLink = await checkRoomInvite(pages[0], ledger.toBase58(), directory);
  assert.equal(signatures.length, beforeSharing, "Sharing a room must not sign a transaction");
  const watcher = await sandbox.command(`watch ${ledger}`, "watching");
  assert.equal(watcher.alreadyWatching, false);
  assert.equal((await sandbox.command(`watch ${ledger}`, "watching")).pid, watcher.pid);
  for (let index = 0; index < 4; index++) {
    if (index === 1) {
      await pages[index].getByRole("button", { name: "Have a room code?", exact: true }).click();
      await pages[index].getByLabel("Room address or invite link", { exact: true }).fill(inviteLink);
      await pages[index].getByRole("button", { name: "Open room", exact: true }).click();
      await pages[index].waitForURL(/room=/);
      assert.equal(new URL(pages[index].url()).searchParams.get("room"), ledger.toBase58());
    } else if (index !== 0) await pages[index].goto(inviteLink);
    await expect(pages[index].getByRole("button", { name: "Join · 0.001 SOL", exact: true })).toBeEnabled();
    await pages[index].getByRole("button", { name: "Join · 0.001 SOL", exact: true }).click();
    await poll(`browser seat ${index} funded`, async () => {
      const room = await client.readRoom(ledger);
      return room.ledger.wallets[index].equals(wallets[index].publicKey) && !room.ledger.sessionSigners[index].equals(PublicKey.default) ? true : undefined;
    });
  }
  console.log("Four independent browser wallets joined; keeper starts the room automatically");
  await expect(pages[0].getByRole("button", { name: "Get sell quote", exact: true })).toBeEnabled();
  await sandbox.command(`pause ${ledger}`, "paused");
  let restartedPid: unknown;
  for (const seat of [0, 1, 2]) {
    const page = pages[seat];
    await expect(page.getByRole("button", { name: "Get sell quote", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Get sell quote", exact: true }).click();
    await page.getByRole("button", { name: "Queue SELL · session key", exact: true }).click();
    const signature = await poll("browser session signature", async () => await page.evaluate(() => Object.keys(localStorage)
      .filter(key => key.startsWith("flinch:v2:")).map(key => JSON.parse(localStorage.getItem(key)!))
      .find(op => op.runtime === "er")?.signature as string | undefined));
    await captureTransaction({ directory }, er, signature, `browser seat ${seat} session SELL`);
    if (seat === 0) {
      await expect(page.getByRole("heading", { name: "Sell queued", exact: true })).toBeVisible();
      const restarted = await sandbox.command(`watch ${ledger}`, "watching");
      restartedPid = restarted.pid;
      assert.notEqual(restarted.pid, watcher.pid);
    }
    const settled = await poll(`browser seat ${seat} sale settles`, async () => {
      sandbox.check();
      const room = await client.readRoom(ledger);
      return room.ledger.economics?.revision === BigInt(seat + 1) ? room : undefined;
    });
    const entitlement = settled.ledger.economics!.usdcClaims[seat];
    assert(entitlement > 0n);
    await expect(page.getByRole("button", { name: "Claim USDC", exact: true })).toBeEnabled();
    await expect(page.locator('[data-sonner-toast][data-type="info"]').filter({ hasText: "Sell request accepted" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Transaction activity" })).not.toContainText("has not been sold yet");
    await page.screenshot({ path: resolve(directory, `player-${seat}-claim.png`), fullPage: true });
    await page.getByRole("button", { name: "Claim USDC", exact: true }).click();
    const destination = getAssociatedTokenAddressSync(USDC_MINT, wallets[seat].publicKey);
    await poll("USDC claim reaches player wallet", async () => {
      if (!await base.getAccountInfo(destination)) return;
      return BigInt((await base.getTokenAccountBalance(destination)).value.amount) === entitlement ? true : undefined;
    });
    journal(directory, "local-claims", { seat, asset: "USDC", amount: entitlement.toString() });
    console.log(`Player ${seat + 1} sold and claimed through the UI`);
  }
  const finalRoom = await client.readRoom(ledger);
  const terminal = finalRoom.ledger.economics!;
  assert.equal(terminal.terminalTag, 1);
  assert.equal(terminal.terminalSeat, 3);
  assert(terminal.holdings[3] > 1_000_000n);
  await expect(pages[3].getByRole("button", { name: "Claim WSOL", exact: true })).toBeEnabled();
  await expect(pages[3].getByRole("article", { name: "WSOL withdrawal" }).getByText(formatUnits(terminal.holdings[3], 9), { exact: true })).toBeVisible();
  await expect(pages[3].locator(".sell-panel")).toHaveCount(0);
  await pages[3].screenshot({ path: resolve(directory, "holder-withdrawal.png"), fullPage: true });
  await pages[3].getByRole("button", { name: "Claim WSOL", exact: true }).click();
  const destination = getAssociatedTokenAddressSync(NATIVE_MINT, wallets[3].publicKey);
  await poll("final holder claims through browser", async () => BigInt((await base.getTokenAccountBalance(destination)).value.amount) === terminal.holdings[3] ? true : undefined);
  const custody = vaults(ledger);
  assert.equal((await base.getTokenAccountBalance(custody.wsolVault)).value.amount, "0");
  assert.equal((await base.getTokenAccountBalance(custody.usdcVault)).value.amount, "0");
  assert.equal((await client.receipts(await client.readRoom(ledger))).length, 3);
  await expect(pages[3].getByRole("heading", { name: "Withdrawals complete", exact: true })).toBeVisible();
  await expect(pages[3].getByRole("button", { name: "Claim WSOL", exact: true })).toHaveCount(0);
  await pages[3].screenshot({ path: resolve(directory, "holder-claimed.png"), fullPage: true });
  for (const signature of signatures) await captureTransaction({ directory }, base, signature, "local player wallet approval");
  const history = await new FileOperationStore(resolve(directory, "local-keeper", ledger.toBase58())).history(ledger.toBase58());
  const operations = [...new Map(history.map(op => [op.signature, op])).values()];
  assert.equal(operations.filter(op => op.action === "execute").length, 3);
  for (const op of operations) {
    await captureTransaction({ directory }, op.runtime === "er" ? er : base, op.signature, `local keeper ${op.action}`);
    if (op.returnSignature) await captureTransaction({ directory }, base, op.returnSignature, "local keeper return proof");
  }
  assert.deepEqual(pageErrors, []);
  journal(directory, "local-final", { ledger: ledger.toBase58(), accounts: await snapshot(base, [ledger, ...Object.values(custody)]),
    commands: sandbox.events, baseSignatures: signatures });
  sandbox.child.stdin.write("quit\n");
  assert.deepEqual(await sandbox.finished, { code: 0, signal: null });
  assert(sandbox.events.some(row => row.event === "stopped" && row.value.temporaryKeysRemoved));
  result(directory, { complete: true, environment: "interactive local sandbox with four browser wallets", syntheticLiquidity: true,
    controlInjected: false, wallets: "four separate test Wallet Standard adapters", allDepositsThroughUi: true,
    swaps: 3, claims: 4, allClaimsThroughUi: true, holderWithdrawal: { exactEntitlement: true, closedFromBaseLedger: true },
    duplicateFundingPrevented: true, explicitRoomWatch: true,
    automaticStart: true, restartedKeeper: restartedPid !== watcher.pid, cleanShutdown: true,
    roomInvite: { clipboard: true, deniedClipboard: true, keyboard: true, reducedMotion: true, noSigning: true, pastedInviteJoin: true },
    ledger: ledger.toBase58() });
  console.log("Local sandbox completed four UI deposits, three swaps and four UI claims");
} catch (error) {
  if (directory) result(directory, { complete: false, environment: "interactive local sandbox", error: String(error) });
  throw error;
} finally { await browser.close(); await sandbox.stop(); }
