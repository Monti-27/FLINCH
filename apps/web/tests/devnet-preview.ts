import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";
import { Keypair } from "@solana/web3.js";
import { DEVNET_GENESIS } from "@flinch/client";
import { browserWallet } from "./browser-wallet.ts";

const url = process.env.FLINCH_UI_URL ?? "http://127.0.0.1:3500/play";
assert.equal(new URL(url).hostname, "127.0.0.1");
const browser = await chromium.launch({ executablePath: process.env.FLINCH_BROWSER_EXECUTABLE });
await mkdir("artifacts/runs", { recursive: true });
const directory = await mkdtemp(resolve("artifacts/runs/devnet-browser-readonly-"));
try {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await browserWallet(page, Keypair.generate(), () => assert.fail("Read-only preview must not sign"));
  await page.goto(url);
  await expect(page.getByText("Preview only · onchain play is not enabled.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Connect wallet", exact: true }).click();
  await page.getByRole("button", { name: /FLINCH local test wallet/ }).click();
  await expect(page.getByRole("button", { name: "Create room", exact: true })).toBeDisabled();
  const genesis = await page.evaluate(async () => {
    const response = await fetch("https://rpc.magicblock.app/devnet", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getGenesisHash", params: [] }) });
    return (await response.json()).result;
  });
  assert.equal(genesis, DEVNET_GENESIS);
  assert.deepEqual(errors, []);
  await writeFile(resolve(directory, "result.json"), JSON.stringify({ complete: true, readOnly: true,
    browserDevnetRpc: true, genesis, walletStandardDiscovery: true, walletExtensionVerified: false, signatures: 0 }, null, 2), { mode: 0o600 });
  console.log(`Read-only devnet browser checks: ${directory}`);
} finally { await browser.close(); }
