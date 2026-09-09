import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { PublicKey } from "@solana/web3.js";
import { connection, DEVNET_GENESIS, verifyNetwork } from "../../packages/client/src/index.ts";
import { decodeHistory } from "../../apps/keeper/src/postgres-store.ts";
import { capture, json } from "./operations.ts";
import { writePrivate } from "./private-files.ts";

const args = process.argv.slice(2);
assert(args.length === 1 || args.length === 2 && args[1] === "--after-restart");
const directory = resolve(args[0]);
const result = JSON.parse(await readFile(resolve(directory, "result.json"), "utf8"));
assert(result.complete && result.hosted && result.network === "devnet");
const room = new PublicKey(result.ledger).toBase58();
const { stdout } = await promisify(execFile)("railway", ["ssh", "--project", "faab688f-6c36-46c1-921f-a379851d470f",
  "--environment", "a8e640c0-d26f-43dc-a8c9-9f4bc715a39e", "--service", "d803ccaa-f495-4668-8aed-aa2e602a0e7c",
  "--", "node", "apps/keeper/src/inspect-hosted.ts", room], { timeout: 30000, maxBuffer: 3_000_000,
  env: { ...process.env, RAILWAY_CALLER: "skill:use-railway@1.4.0", RAILWAY_AGENT_SESSION: "flinch-activate-20260911" } });
const line = stdout.split("\n").find(value => value.startsWith('{"room":'));
assert(line, "Hosted history response missing");
const report = JSON.parse(line);
assert.equal(report.room, room);
const history = decodeHistory(report.history, room);
assert(history.length > 0);
assert(history.every(operation => operation.genesis === DEVNET_GENESIS));
assert.notEqual(history.at(-1)!.status, "pending");
const digest = createHash("sha256").update(json(history)).digest("hex");
if (args[1] === "--after-restart") {
  const before = JSON.parse(await readFile(resolve(directory, "hosted-proof.json"), "utf8"));
  assert.equal(digest, before.historySha256, "Hosted journal changed across restart");
  await writePrivate(resolve(directory, "hosted-restart.json"), json({ verified: true, room, historySha256: digest,
    checkedAt: new Date().toISOString(), transitions: history.length }));
  console.log(`Hosted journal retained across replacement: ${history.length} transitions`);
} else {
  const base = connection("https://rpc.magicblock.app/devnet", "devnet");
  await verifyNetwork(base, "devnet", DEVNET_GENESIS);
  await writePrivate(resolve(directory, "keeper-history.json"), json(history));
  const operations = [...new Map(history.map(operation => [operation.signature, operation])).values()];
  const returns = new Set<string>();
  let swaps = 0;
  for (const operation of operations) {
    assert.notEqual(operation.status, "failed");
    await capture(directory, operation.runtime === "base" ? base : connection(operation.endpoint, "devnet"), operation.signature,
      `hosted-keeper-${operation.action}`);
    if (operation.action === "execute") swaps++;
    if (operation.returnSignature && !returns.has(operation.returnSignature)) {
      await capture(directory, base, operation.returnSignature, "hosted-base-return");
      returns.add(operation.returnSignature);
    }
  }
  assert.equal(swaps, result.swaps);
  assert.equal(returns.size, result.swaps);
  await writePrivate(resolve(directory, "hosted-proof.json"), json({ verified: true, room, historySha256: digest,
    transitions: history.length, keeperTransactions: operations.length, swaps, baseReturns: returns.size,
    checkedAt: new Date().toISOString() }));
  console.log(`Hosted journal verified: ${operations.length} transactions, ${swaps} swaps, ${returns.size} base returns`);
}
