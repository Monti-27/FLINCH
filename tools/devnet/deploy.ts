import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { open } from "node:fs/promises";
import { DEVNET } from "./settings.ts";
import { probeDevnet } from "./probe.ts";
import { privateDirectory, readKey } from "./private-files.ts";

export async function deployDevnet(directory: string, execute: boolean) {
  if (!execute) throw new Error("Deployment requires --execute-devnet");
  const location = await privateDirectory(directory);
  const before = await probeDevnet(location);
  if (before.deployed) return { alreadyDeployed: true, program: before.program, bytecodeVerified: true };
  if (before.balance < before.budget.requested) throw new Error("Deployment wallet is below the prepared funding budget");
  await readKey(resolve(location, "buffer.json"));
  const output = await open(resolve(location, `deploy-${Date.now()}.log`), "wx", 0o600);
  try {
    const child = spawn("solana", ["--url", before.baseUrl, "--keypair", resolve(location, "deployer.json"),
      "program", "deploy", resolve(location, "build/flinch_v2.so"), "--program-id", resolve(location, "build/flinch_v2-keypair.json"),
      "--buffer", resolve(location, "buffer.json"), "--upgrade-authority", resolve(location, "deployer.json"),
      "--fee-payer", resolve(location, "deployer.json"), "--max-len", String(before.binary.bytes), "--use-rpc", "--with-compute-unit-price", "0", "--output", "json"],
    { stdio: ["ignore", output.fd, output.fd] });
    await new Promise<void>((done, reject) => { child.once("error", reject); child.once("exit", code => code === 0 ? done() : reject(new Error("Deployment stopped; retain the buffer and private log for reconciliation"))); });
  } finally { await output.close(); }
  const after = await probeDevnet(location);
  if (!after.deployed) throw new Error("Program bytecode was not confirmed on devnet");
  return { program: DEVNET.program.toBase58(), bytecodeVerified: true, authority: after.deployer, ...after.flinch };
}

if (process.argv[1] === import.meta.filename) {
  try {
    if (process.argv.length !== 5 || process.argv[2] !== "--directory" || process.argv[4] !== "--execute-devnet") throw new Error("Explicit devnet deployment arguments are required");
    console.log(JSON.stringify(await deployDevnet(process.argv[3], true), null, 2));
  } catch { console.error("Deployment did not complete. Inspect the private log and run devnet:probe before retrying; do not discard its buffer."); process.exitCode = 1; }
}
