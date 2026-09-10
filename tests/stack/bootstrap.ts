import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync, openSync, closeSync } from "node:fs";
import { resolve } from "node:path";
import { Connection, Keypair } from "@solana/web3.js";
import { LiteSVM } from "litesvm";
import { ConnectionMagicRouter } from "@magicblock-labs/ephemeral-rollups-sdk";
import { seedPoolFixture } from "../local/support/pool.ts";
import { seedUsdcFixture } from "../local/support/tokens.ts";
import { PROGRAM_ID, RAYDIUM_ID, USDC } from "../local/support/runtime.ts";
import { poll } from "./rpc.ts";
import { journal, result, sourceManifest } from "./evidence.ts";
import { observeExit, requireFreePorts, stopChild } from "./process.ts";
import { startBaseService } from "./base-service.ts";
import { programBinary, raydiumBinary, verifyArtifacts } from "../local/support/artifacts.ts";
import { ports, loopback } from "./ports.ts";

type BaseTransport = { url: string; stop(): Promise<void> };

export async function startStack(options: { baseTransport?: (upstream: string, directory: string) => Promise<BaseTransport> } = {}) {
  verifyArtifacts();
  await requireFreePorts([ports.base, ports.base + 1, ports.er, ports.er + 1, ports.router, ports.router + 1, ports.faucet]);
  mkdirSync("artifacts/runs", { recursive: true });
  const directory = mkdtempSync(resolve("artifacts/runs/mb-stack-"));
  journal(directory, "manifest", { source: sourceManifest(), node: process.version,
    syntheticLiquidity: true, controlInjected: false });
  const host = Keypair.generate();
  const svm = new LiteSVM().withNativeMints();
  seedUsdcFixture(svm);
  const pool = await seedPoolFixture(svm);
  const genesis = [USDC, pool.pool, pool.ammConfig, pool.observation, pool.poolWsolVault, pool.poolUsdcVault];
  const args = [resolve("node_modules/@magicblock-labs/ephemeral-validator/mbStack.js"),
    "--ledger", resolve(directory, "ledger"), "--mint", host.publicKey.toBase58(), "--faucet-port", String(ports.faucet),
    "--bind-address", "127.0.0.1", "--dynamic-port-range", ports.dynamic, "--gossip-port", String(ports.faucet + 1),
    "--bpf-program", PROGRAM_ID.toBase58(), programBinary,
    "--bpf-program", RAYDIUM_ID.toBase58(), raydiumBinary];
  for (const key of genesis) {
    const account = svm.getAccount(key)!;
    const path = resolve(directory, `${key.toBase58()}.json`);
    writeFileSync(path, JSON.stringify({ pubkey: key.toBase58(), account: { ...account,
      owner: account.owner.toBase58(), data: [Buffer.from(account.data).toString("base64"), "base64"], rentEpoch: 0 } }), { mode: 0o600 });
    args.push("--account", key.toBase58(), path);
  }
  const configuration = { commitment: "confirmed" as const, disableRetryOnRateLimit: true,
    fetch: (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
      fetch(input, { ...init, signal: AbortSignal.timeout(5000) }) };
  const base = new Connection(loopback(ports.base), configuration);
  const er = new ConnectionMagicRouter(loopback(ports.er), configuration);
  let separateBase: Awaited<ReturnType<typeof startBaseService>> | undefined;
  let transport: BaseTransport | undefined;
  try {
    if (options.baseTransport) {
      separateBase = await startBaseService(args.slice(1), directory, base);
      transport = await options.baseTransport(base.rpcEndpoint, directory);
      assert.equal(new URL(transport.url).hostname, "127.0.0.1");
    }
  } catch (error) {
    await Promise.allSettled([separateBase?.stop(), transport?.stop()]);
    result(directory, { complete: false, stage: "base transport startup", error: String(error) });
    throw error;
  }
  const log = openSync(resolve(directory, "stack.log"), "a", 0o600);
  const child = spawn(process.execPath, args, { cwd: directory, stdio: ["ignore", log, log],
    env: { ...process.env, RUST_LOG: "info", MB_STACK_ER_REMOTES: transport ? `${transport.url},${loopback(ports.base + 1, "ws")}` : "",
      MB_STACK_BASE_PORT: String(ports.base), MB_STACK_ER_PORT: String(ports.er), MB_STACK_PUBLIC_PORT: String(ports.router) } });
  closeSync(log);
  const finished = Promise.race([observeExit(child), ...separateBase ? [separateBase.finished] : []]);
  const stop = async () => {
    const results = [];
    for (const action of [() => stopChild(child), () => separateBase?.stop(), () => transport?.stop()]) {
      try { await action(); } catch (error) { results.push(error); }
    }
    if (results.length) throw new AggregateError(results, "Local stack cleanup incomplete");
  };
  try {
    await poll("local stack startup", async () => {
      assert.equal(child.exitCode, null, `Stack exited; inspect ${directory}/stack.log`);
      const response = await fetch(loopback(ports.router), { method: "POST", body: "{}", signal: AbortSignal.timeout(1000) });
      if (!response) return;
      const identity = await er.getClosestValidator();
      return identity.identity && await base.getBlockHeight("confirmed") > 0 ? true : undefined;
    }, 60_000, true);
    assert((await base.getAccountInfo(PROGRAM_ID))?.executable);
    journal(directory, "environment", { baseVersion: await base.getVersion(), erVersion: await er.getVersion(),
      genesis: await base.getGenesisHash(), validator: await er.getClosestValidator(),
      baseEndpoint: base.rpcEndpoint, erEndpoint: er.rpcEndpoint, erBaseTransport: transport?.url ?? base.rpcEndpoint });
    return { directory, host, pool, base, er, child, finished, stop };
  } catch (error) {
    result(directory, { complete: false, stage: "startup", error: String(error) });
    await stop();
    throw error;
  }
}

export type Stack = Awaited<ReturnType<typeof startStack>>;
