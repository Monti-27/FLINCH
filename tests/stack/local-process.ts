import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { poll } from "./rpc.ts";
import { stopChild } from "./process.ts";

export type LocalInfo = { url: string; network: string; genesis: string; baseRpc: string; erRpc: string; pool: string;
  validator: string; keeperPayer: string; evidence: string; processes: { stack: number; web: number };
  syntheticLiquidity: boolean; durableAcrossSandboxRestarts: boolean };
type LocalEvent = { event: string; value: Record<string, unknown> };

export function startLocalProcess() {
  const child = spawn(process.execPath, [resolve("tools/local/run.ts"), "--execute-local"], { stdio: ["pipe", "pipe", "pipe"] });
  const events: LocalEvent[] = [];
  let buffer = "";
  let stderr = "";
  let spawnError: Error | undefined;
  const finished = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(resolveExit => {
    child.once("error", error => { spawnError = error; resolveExit({ code: null, signal: null }); });
    child.once("exit", (code, signal) => resolveExit({ code, signal }));
  });
  child.stdout.setEncoding("utf8").on("data", chunk => {
    buffer += chunk;
    for (let newline = buffer.indexOf("\n"); newline >= 0; newline = buffer.indexOf("\n")) {
      events.push(JSON.parse(buffer.slice(0, newline)));
      buffer = buffer.slice(newline + 1);
    }
  });
  child.stderr.setEncoding("utf8").on("data", chunk => { stderr = (stderr + chunk).slice(-16_384); });
  const check = () => {
    if (spawnError) throw spawnError;
    assert.equal(child.exitCode, null, JSON.stringify({ events, stderr }));
    assert.equal(child.signalCode, null, "Sandbox process stopped unexpectedly");
  };
  return { child, events, finished, check, stop: () => stopChild(child),
    ready: () => poll("interactive local sandbox ready", async () => {
      check();
      return events.find(row => row.event === "ready")?.value as LocalInfo | undefined;
    }, 90_000),
    command: async (line: string, expected: string) => {
      check();
      const from = events.length;
      child.stdin.write(line + "\n");
      return poll(`sandbox command ${expected}`, async () => {
        check();
        const later = events.slice(from);
        assert(!later.some(row => row.event === "error"), JSON.stringify(later));
        return later.find(row => row.event === expected)?.value;
      });
    }
  };
}
