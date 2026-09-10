import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { test } from "node:test";
import { LocalLifecycle } from "../../tools/local/lifecycle.ts";
import { observeExit, stopChild } from "../stack/process.ts";

test("sandbox waits for all keepers, attempts every service, retains keys when a keeper cannot drain", async () => {
  const steps: string[] = [];
  const lifecycle = new LocalLifecycle({
    rooms: async () => { steps.push("rooms"); throw new Error("busy"); },
    web: async () => { steps.push("web"); throw new Error("busy"); },
    stack: async () => { steps.push("stack"); }, keys: async () => { steps.push("keys"); },
  });
  const stopping = lifecycle.stop();
  assert.equal(lifecycle.stop(), stopping);
  await assert.rejects(stopping, AggregateError);
  assert.deepEqual(steps, ["rooms", "web", "stack"]);
  assert.throws(() => lifecycle.check(), /stopping/);
});

test("sandbox cleanup drains rooms before deleting keys and ignores intentional service exits", async () => {
  const steps: string[] = [];
  let finishRooms!: () => void;
  let exitWeb!: (value: { code: number; signal: null }) => void;
  const lifecycle = new LocalLifecycle({
    rooms: () => new Promise<void>(resolve => { finishRooms = resolve; }), web: async () => { steps.push("web"); },
    stack: async () => { steps.push("stack"); }, keys: async () => { steps.push("keys"); },
  });
  lifecycle.watch("web", new Promise(resolve => { exitWeb = resolve; }));
  let failed = false;
  void lifecycle.failure.then(() => { failed = true; });
  const stopping = lifecycle.stop();
  await Promise.resolve();
  exitWeb({ code: 0, signal: null });
  assert.deepEqual(steps, ["web"]);
  finishRooms();
  await stopping;
  assert.deepEqual(steps, ["web", "stack", "keys"]);
  assert.equal(failed, false);
});

test("actual unexpected child exit invalidates sandbox readiness and failed spawn is observed", async () => {
  const child = spawn(process.execPath, ["-e", "process.exit(7)"], { stdio: "ignore" });
  const lifecycle = new LocalLifecycle({ rooms: () => undefined, web: () => stopChild(child),
    stack: () => undefined, keys: () => undefined });
  lifecycle.watch("web", observeExit(child));
  assert.deepEqual(await lifecycle.failure, { service: "web", code: 7, signal: null });
  assert.throws(() => lifecycle.check(), /web process stopped/);
  await lifecycle.stop();
  const missing = spawn("/nonexistent/flinch-test-executable", [], { stdio: "ignore" });
  assert.equal((await observeExit(missing)).failedToStart, true);
  await stopChild(missing);
});

test("local base wrapper receives its supported interrupt and exits before cleanup returns", async () => {
  const child = spawn(process.execPath, ["-e", "process.on('SIGINT', () => process.exit(0)); setInterval(() => {}, 1000); process.stdout.write('ready');"],
    { stdio: ["ignore", "pipe", "ignore"] });
  const finished = observeExit(child);
  await new Promise<void>(resolve => child.stdout.once("data", () => resolve()));
  await stopChild(child, "SIGINT");
  assert.deepEqual(await finished, { code: 0, signal: null });
});
