import { mkdir, mkdtemp } from "node:fs/promises";
import { resolve } from "node:path";
import { FlinchClient, connection } from "../../packages/client/src/index.ts";
import { runKeeper } from "../../apps/keeper/src/runtime/service.ts";
import { readConfig } from "../../apps/keeper/src/runtime/config.ts";
import { FileOperationStore } from "../../apps/keeper/src/file-store.ts";
import { readKey, privateDirectory, writePrivate } from "./private-files.ts";
import { probeDevnet } from "./probe.ts";
import { playDevnetRound } from "./round.ts";
import { capture, json, record, waitFor } from "./operations.ts";
import { preparationFailure } from "./sell.ts";

export async function runSoak(directory: string, execute: boolean) {
  if (!execute) throw new Error("Ten real rounds require --execute-devnet");
  const location = await privateDirectory(directory);
  const preflight = await probeDevnet(location);
  if (!preflight.deployed) throw new Error("Verified devnet deployment is required");
  const config = await readConfig(resolve(location, "keeper-config.json"));
  const client = new FlinchClient({ network: "devnet", baseUrl: preflight.baseUrl, expectedGenesis: preflight.genesis });
  const players = await Promise.all([0, 1, 2, 3].map(seat => readKey(resolve(location, `player-${seat}.json`))));
  for (const key of [...players.map(player => player.publicKey), config.payer!]) {
    if (await client.base.getBalance(key, "confirmed") < 100_000_000) throw new Error("Fund prepared test participants before starting ten rounds");
  }
  await mkdir("artifacts/runs", { recursive: true });
  const evidence = await mkdtemp(resolve("artifacts/runs/devnet-soak-"));
  await writePrivate(resolve(evidence, "preflight.json"), json(preflight));
  console.log(`Devnet test evidence: ${evidence}`);
  const abort = new AbortController();
  const stop = () => abort.abort();
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  let failure: unknown;
  let ready = false;
  const service = runKeeper(config, true, event => { if (event.event === "ready") ready = true; console.log(json(event)); }, abort.signal)
    .catch(error => { failure = error; abort.abort(); });
  const rooms = [];
  try {
    await waitFor("keeper startup", async () => ready ? true : undefined, abort.signal);
    for (let index = 0; index < 10; index++) {
      const room = await playDevnetRound(client, players, evidence, index, abort.signal);
      rooms.push(room.toBase58());
      const history = await new FileOperationStore(config.journalDirectory).history(room.toBase58());
      for (const operation of new Map(history.map(item => [item.signature, item])).values()) {
        await capture(evidence, operation.runtime === "base" ? client.base : connection(operation.endpoint, "devnet"), operation.signature, `keeper-${operation.action}`, abort.signal);
        if (operation.returnSignature) await capture(evidence, client.base, operation.returnSignature, "base-return", abort.signal);
      }
      console.log(`Confirmed devnet round ${index + 1}/10`);
    }
    if (failure) throw failure;
    await writePrivate(resolve(evidence, "result.json"), json({ complete: true, network: "devnet", rooms, swaps: 20, claims: 40,
      syntheticLiquidity: false, controlInjected: false, walletExtensionsVerified: false, forcedRecoveryVerified: false }));
  } catch (error) {
    await record(evidence, { event: "stopped", completedRounds: rooms.length, rooms, ...preparationFailure(error), message: "Inspect retained signatures and unfinished round plans. Do not blindly repeat a submission." });
    throw new Error("Devnet rounds stopped; reconcile evidence before another run");
  } finally {
    abort.abort(); await service;
    process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop);
  }
  return { evidence, confirmedRounds: rooms.length };
}

if (process.argv[1] === import.meta.filename) {
  try {
    if (process.argv.length !== 5 || process.argv[2] !== "--directory" || process.argv[4] !== "--execute-devnet") throw new Error("Explicit devnet test arguments required");
    console.log(json(await runSoak(process.argv[3], true)));
  } catch { console.error("Devnet test run did not complete. Inspect its evidence before resuming."); process.exitCode = 1; }
}
