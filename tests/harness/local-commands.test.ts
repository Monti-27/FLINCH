import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { Keypair, PublicKey } from "@solana/web3.js";
import { parseCommand } from "../../tools/local/commands.ts";

test("local commands accept only public, bounded explicit actions", () => {
  for (const kind of ["status", "help", "quit"]) assert.deepEqual(parseCommand(kind), { kind });
  const wallet = Keypair.generate().publicKey;
  for (const kind of ["fund", "watch", "pause"]) {
    const command = parseCommand(`${kind} ${wallet.toBase58()}`);
    assert.equal(command.kind, kind);
    assert("address" in command && command.address.equals(wallet));
  }
  for (const command of ["", "status extra", "fund", "fund not-a-public-key", `fund ${PublicKey.default}`, "quit now",
    `watch ${wallet} extra`, "deploy mainnet", "fund " + "1".repeat(257), JSON.stringify([...Keypair.generate().secretKey])]) {
    assert.throws(() => parseCommand(command));
  }
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from("test")], wallet);
  assert.equal(parseCommand(`watch ${pda}`).kind, "watch");
  assert.throws(() => parseCommand(`fund ${pda}`));
});

test("sandbox help is read-only and starting requires an explicit local execution flag", async () => {
  const run = (args: string[]) => new Promise<{ code: number; stdout: string }>(done => {
    execFile(process.execPath, [resolve("tools/local/run.ts"), ...args], { timeout: 5000 },
      (error, stdout) => done({ code: error ? Number(error.code) : 0, stdout }));
  });
  const help = await run(["--help"]);
  assert.equal(help.code, 0);
  assert.equal(JSON.parse(help.stdout).event, "help");
  const denied = await run([]);
  assert.equal(denied.code, 1);
  assert.equal(JSON.parse(denied.stdout).value.code, "local_execution_required");
});
