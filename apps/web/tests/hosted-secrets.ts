import assert from "node:assert/strict";
import { readFile, mkdtemp } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { writePrivate } from "../../../tools/devnet/private-files.ts";

const origin = "https://flinch.up.railway.app";
const privateRoot = "/Users/montisaini/.config/flinch/devnet";
const keyPaths = ["deployer.json", "keeper.json", "buffer.json", "build/flinch_v2-keypair.json",
  ...[0, 1, 2, 3].map(seat => `player-${seat}.json`)];
const secrets = await Promise.all(keyPaths.map(async path => JSON.stringify(JSON.parse(await readFile(resolve(privateRoot, path), "utf8")))));
const browser = await chromium.launch({ executablePath: process.env.FLINCH_BROWSER_EXECUTABLE });
const context = await browser.newContext();
const page = await context.newPage();
const fetched = new Map<string, Promise<void>>();
const findings: string[] = [];
const inspect = async (url: string, text: string) => {
  const compact = text.replace(/\s+/g, "");
  if (secrets.some(secret => compact.includes(secret)) || /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/.test(text)
    || /postgres(?:ql)?:\/\/[^\s"']+:[^\s"']+@/.test(text)) findings.push(url);
};
page.on("response", response => {
  const url = response.url();
  if (!url.startsWith(origin) || !["script", "document"].includes(response.request().resourceType()) || fetched.has(url)) return;
  fetched.set(url, response.text().then(text => inspect(url, text)));
});
try {
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.goto(`${origin}/play`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Connect wallet", exact: true }).click();
  await page.locator(".wallet-adapter-modal").waitFor();
  await Promise.all(fetched.values());
  assert(fetched.size > 5);
  assert.equal(findings.length, 0, "Selected secret patterns found in public browser assets");
  const evidence = await mkdtemp(resolve("artifacts/runs/hosted-bundle-"));
  await writePrivate(resolve(evidence, "result.json"), JSON.stringify({ checkedAt: new Date().toISOString(), origin,
    passed: true, checkedResources: fetched.size, knownKeysChecked: secrets.length, findings,
    scope: "Loaded landing, arena and wallet-picker JavaScript and HTML; selected patterns only", urls: [...fetched.keys()] }, null, 2));
  console.log(`Public bundle check passed: ${fetched.size} resources; ${evidence}`);
} finally { await browser.close(); }
