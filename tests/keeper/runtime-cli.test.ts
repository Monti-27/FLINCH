import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { key } from "./fixtures.ts";

function cli(args: string[]) {
  return new Promise<{ code: number; stdout: string; stderr: string }>(resolveResult => {
    execFile(process.execPath, [resolve("apps/keeper/src/cli.ts"), ...args], { timeout: 10_000, maxBuffer: 16_384 },
      (error, stdout, stderr) => resolveResult({ code: error ? Number(error.code) : 0, stdout, stderr }));
  });
}

test("CLI defaults never run or expose rejected argument values", async () => {
  const help = await cli(["--help"]);
  assert.equal(help.code, 0);
  assert.match(help.stdout, /Inspect:/);
  for (const args of [[], ["run", "--config", "/private/secret-config.json"], ["inspect", "--config", "/private/secret-config.json", "--execute"]]) {
    const result = await cli(args);
    assert.equal(result.code, 1);
    assert.equal(JSON.parse(result.stdout).code, "invalid_arguments");
    assert(!result.stdout.includes("secret-config"));
  }
});

test("CLI wrong-chain startup performs no account reads, key loading or transaction submission", async t => {
  const directory = await mkdtemp(join(tmpdir(), "flinch-cli-chain-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const methods: string[] = [];
  const server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    const input = JSON.parse(body);
    methods.push(input.method);
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ jsonrpc: "2.0", id: input.id, result: key().toBase58() }));
  });
  await new Promise<void>(resolveListen => server.listen(0, "127.0.0.1", resolveListen));
  t.after(() => new Promise<void>(resolveClose => server.close(() => resolveClose())));
  const address = server.address();
  assert(address && typeof address !== "string");
  const journalDirectory = join(directory, "journal");
  const config = join(directory, "config.json");
  await writeFile(config, JSON.stringify({ version: 1, network: "localnet", baseUrl: `http://127.0.0.1:${address.port}`,
    localErUrl: `http://127.0.0.1:${address.port}`, expectedGenesis: key().toBase58(), rooms: [key().toBase58()],
    journalDirectory, keypairFile: join(directory, "missing-payer.json"), payer: key().toBase58() }), { mode: 0o600 });
  const inspection = await cli(["inspect", "--config", config]);
  assert.equal(inspection.code, 1);
  assert.equal(JSON.parse(inspection.stdout).code, "wrong_network");
  await assert.rejects(access(journalDirectory));
  const execution = await cli(["run", "--config", config, "--execute"]);
  assert.equal(execution.code, 1);
  assert.equal(JSON.parse(execution.stdout).code, "wrong_network");
  await assert.rejects(access(join(journalDirectory, "keeper.lock")));
  assert.deepEqual(methods, ["getGenesisHash", "getGenesisHash"]);
  assert(!execution.stdout.includes(directory));
});
