import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import type { RuntimeEvent } from "../../apps/keeper/src/runtime/service.ts";
import { journal } from "./evidence.ts";
import { stopChild } from "./process.ts";
import { poll } from "./rpc.ts";

export function startKeeperProcess(config: string, directory: string, command: "run" | "inspect" = "run",
  stopAfter?: (event: RuntimeEvent) => boolean) {
  const child = spawn(process.execPath, [resolve("apps/keeper/src/cli.ts"), command, "--config", config,
    ...command === "run" ? ["--execute"] : []], { stdio: ["ignore", "pipe", "pipe"] });
  const events: RuntimeEvent[] = [];
  let output = "";
  let stderr = "";
  let processError: Error | undefined;
  const finished = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(resolve => {
    child.once("error", error => { processError = error; resolve({ code: null, signal: null }); });
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
  child.stdout.setEncoding("utf8").on("data", chunk => {
    output += chunk;
    for (let newline = output.indexOf("\n"); newline >= 0; newline = output.indexOf("\n")) {
      const line = output.slice(0, newline);
      output = output.slice(newline + 1);
      const event: RuntimeEvent = JSON.parse(line);
      events.push(event);
      journal(directory, "service-events", { pid: child.pid, ...event });
      if (stopAfter?.(event)) child.kill("SIGTERM");
    }
  });
  child.stderr.setEncoding("utf8").on("data", chunk => { stderr = (stderr + chunk).slice(-16_384); });
  return { child, events, finished, stop: () => stopChild(child), stderr: () => stderr,
    ready: () => poll("standalone keeper ready", async () => {
      if (processError) throw processError;
      assert.equal(child.exitCode, null, JSON.stringify({ events, stderr }));
      assert.equal(child.signalCode, null, "keeper exited before ready");
      return events.some(event => event.event === "ready") ? true : undefined;
    }) };
}

export type KeeperProcess = ReturnType<typeof startKeeperProcess>;
