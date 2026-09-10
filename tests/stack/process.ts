import assert from "node:assert/strict";
import { createServer } from "node:net";
import { setTimeout } from "node:timers/promises";
import type { ChildProcess } from "node:child_process";

export type ProcessExit = { code: number | null; signal: NodeJS.Signals | null; failedToStart?: true };

export function observeExit(child: ChildProcess): Promise<ProcessExit> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve({ code: child.exitCode, signal: child.signalCode });
  return new Promise(resolve => {
    const finish = (value: ProcessExit) => {
      child.removeListener("exit", exited);
      child.removeListener("error", failed);
      resolve(value);
    };
    const exited = (code: number | null, signal: NodeJS.Signals | null) => finish({ code, signal });
    const failed = () => finish({ code: null, signal: null, failedToStart: true });
    child.once("exit", exited);
    child.once("error", failed);
  });
}

export async function requireFreePorts(ports: number[]) {
  for (const port of ports) {
    await new Promise<void>((resolve, reject) => {
      const server = createServer();
      server.once("error", reject);
      server.listen(port, "127.0.0.1", () => server.close(error => error ? reject(error) : resolve()));
    });
  }
}

export async function stopChild(child: ChildProcess, signal: NodeJS.Signals = "SIGTERM") {
  if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise<void>(resolve => child.once("exit", () => resolve()));
  child.kill(signal);
  const timer = new AbortController();
  try {
    await Promise.race([exited, setTimeout(8000, undefined, { signal: timer.signal }).catch(() => undefined)]);
  } finally {
    timer.abort();
  }
  assert(child.exitCode !== null || child.signalCode !== null, `Local supervisor ${child.pid} did not stop; inspect its process groups`);
}
