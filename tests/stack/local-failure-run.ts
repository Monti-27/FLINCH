import assert from "node:assert/strict";
import { startLocalProcess } from "./local-process.ts";
import { poll } from "./rpc.ts";
import { requireFreePorts } from "./process.ts";
import { journal, result } from "./evidence.ts";

const sandbox = startLocalProcess();
let directory: string | undefined;
try {
  const info = await sandbox.ready();
  directory = info.evidence;
  assert(Number.isSafeInteger(info.processes.web) && info.processes.web > 1);
  process.kill(info.processes.web, "SIGTERM");
  await poll("sandbox exits after web termination", async () =>
    sandbox.child.exitCode !== null || sandbox.child.signalCode !== null ? true : undefined, 30_000);
  assert.deepEqual(await sandbox.finished, { code: 1, signal: null });
  assert(sandbox.events.some(row => row.event === "error" && row.value.code === "service_stopped" && row.value.service === "web"));
  assert(sandbox.events.some(row => row.event === "stopped" && row.value.temporaryKeysRemoved === true));
  await requireFreePorts([3400, 18899, 18900, 17799, 17800, 16699, 16700, 19900]);
  journal(directory, "local-failure", sandbox.events);
  result(directory, { complete: true, environment: "interactive local sandbox", fault: "actual web process terminated",
    failureReported: true, exitCode: 1, allServicePortsReleased: true, syntheticLiquidity: true, gameplayTested: false });
  console.log(`Local failure cleanup passed: ${directory}`);
} catch (error) {
  if (directory) result(directory, { complete: false, error: String(error) });
  throw error;
} finally { await sandbox.stop(); }
