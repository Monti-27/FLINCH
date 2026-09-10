import { spawn } from "node:child_process";
import { openSync, closeSync } from "node:fs";
import { resolve } from "node:path";
import type { Stack } from "../../tests/stack/bootstrap.ts";
import { observeExit, stopChild } from "../../tests/stack/process.ts";
import { poll } from "../../tests/stack/rpc.ts";

export const LOCAL_WEB_PORT = 3400;
export const LOCAL_WEB_URL = `http://127.0.0.1:${LOCAL_WEB_PORT}/play`;

export async function startLocalWeb(stack: Stack, genesis: string, validator: string) {
  const log = openSync(resolve(stack.directory, "local-web.log"), "a", 0o600);
  const child = spawn(process.execPath, [resolve("apps/web/node_modules/next/dist/bin/next"), "dev", "--webpack", "--hostname", "127.0.0.1", "--port", String(LOCAL_WEB_PORT)], {
    cwd: resolve("apps/web"), stdio: ["ignore", log, log], env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1",
      NEXT_PUBLIC_FLINCH_NETWORK: "localnet", NEXT_PUBLIC_FLINCH_BASE_RPC: stack.base.rpcEndpoint,
      NEXT_PUBLIC_FLINCH_LOCAL_ER: stack.er.rpcEndpoint, NEXT_PUBLIC_FLINCH_GENESIS: genesis,
      NEXT_PUBLIC_FLINCH_ENABLE_TRANSACTIONS: "true", NEXT_PUBLIC_FLINCH_POOL: stack.pool.pool.toBase58(),
      NEXT_PUBLIC_FLINCH_VALIDATOR: validator }
  });
  closeSync(log);
  const finished = observeExit(child);
  try {
    await poll("local web startup", async () => {
      if (child.exitCode !== null || child.signalCode !== null) throw new Error("Local web process stopped");
      return (await fetch(LOCAL_WEB_URL, { signal: AbortSignal.timeout(1500) })).ok ? true : undefined;
    }, 60_000, true);
    return { child, finished, stop: () => stopChild(child) };
  } catch (error) { await stopChild(child); throw error; }
}
