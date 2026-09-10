import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { openSync, closeSync } from "node:fs";
import { resolve } from "node:path";
import type { Connection } from "@solana/web3.js";
import { DELEGATION_PROGRAM_ID } from "@magicblock-labs/ephemeral-rollups-sdk";
import { poll } from "./rpc.ts";
import { observeExit, stopChild } from "./process.ts";

export async function startBaseService(args: string[], directory: string, base: Connection) {
  const log = openSync(resolve(directory, "base.log"), "a", 0o600);
  const child = spawn(process.execPath, [resolve("node_modules/@magicblock-labs/ephemeral-validator/mbTestValidator.js"),
    "--rpc-port", new URL(base.rpcEndpoint).port, ...args], { cwd: directory, stdio: ["ignore", log, log] });
  closeSync(log);
  const finished = observeExit(child);
  const stop = () => stopChild(child, "SIGINT");
  try {
    await poll("separate local base startup", async () => {
      assert.equal(child.exitCode, null);
      assert.equal(child.signalCode, null);
      return (await base.getAccountInfo(DELEGATION_PROGRAM_ID))?.executable && await base.getBlockHeight() > 0 ? true : undefined;
    }, 60_000, true);
    return { child, finished, stop };
  } catch (error) {
    await stop();
    throw error;
  }
}
