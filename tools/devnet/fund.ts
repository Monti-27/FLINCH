import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { SystemProgram } from "@solana/web3.js";
import { connection } from "../../packages/client/src/index.ts";
import { probeDevnet } from "./probe.ts";
import { privateDirectory, readKey, writePrivate } from "./private-files.ts";
import { json, sendRecorded } from "./operations.ts";
import { acquireJournal } from "../../apps/keeper/src/runtime/lease.ts";

export async function fundDemo(directory: string, execute: boolean) {
  if (!execute) throw new Error("Funding requires --execute-devnet");
  const location = await privateDirectory(directory);
  const release = await acquireJournal(resolve(location, "funding-lock"));
  try {
    const preflight = await probeDevnet(location);
    if (!preflight.deployed) throw new Error("Deploy and verify the program before funding test participants");
    const payer = await readKey(resolve(location, "deployer.json"));
    const base = connection(preflight.baseUrl, "devnet");
    const targets = [];
    for (const name of ["keeper", "player-0", "player-1", "player-2", "player-3"]) {
      const key = await readKey(resolve(location, `${name}.json`));
      const balance = await base.getBalance(key.publicKey, "confirmed");
      if (!Number.isSafeInteger(balance) || balance < 0) throw new Error("Invalid participant balance");
      const minimum = name === "keeper" ? 300_000_000n : 150_000_000n;
      targets.push({ name, address: key.publicKey, before: BigInt(balance), amount: minimum > BigInt(balance) ? minimum - BigInt(balance) : 0n });
    }
    const total = targets.reduce((sum, target) => sum + target.amount, 0n);
    if (total === 0n) return { alreadyFunded: true };
    if (preflight.balance < total + 1_000_000n) throw new Error("Deployment wallet cannot fund the prepared participant budget");
    const evidence = resolve(location, "participant-funding");
    await mkdir(evidence, { mode: 0o700 });
    await writePrivate(resolve(evidence, "plan.json"), json({ network: "devnet", payer: payer.publicKey, targets, total }));
    await sendRecorded(evidence, "fund-participants", base, targets.filter(target => target.amount > 0n).map(target =>
      SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: target.address, lamports: target.amount })), [payer]);
    return { confirmed: true, evidence, total: total.toString() };
  } finally { await release(); }
}

if (process.argv[1] === import.meta.filename) {
  try {
    if (process.argv.length !== 5 || process.argv[2] !== "--directory" || process.argv[4] !== "--execute-devnet") throw new Error("Explicit devnet funding arguments are required");
    console.log(json(await fundDemo(process.argv[3], true)));
  } catch { console.error("Participant funding stopped. Retain its plan and signature; do not retry an uncertain transfer."); process.exitCode = 1; }
}
