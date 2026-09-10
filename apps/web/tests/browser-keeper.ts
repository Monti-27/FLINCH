import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Keypair, SystemProgram } from "@solana/web3.js";
import type { PublicKey } from "@solana/web3.js";
import { FileOperationStore } from "../../keeper/src/index.ts";
import type { Stack } from "../../../tests/stack/bootstrap.ts";
import { captureTransaction, sendClient } from "../../../tests/stack/client.ts";
import { startKeeperProcess } from "../../../tests/stack/service-process.ts";

export async function startBrowserKeeper(stack: Stack, room: PublicKey) {
  const directory = await mkdtemp(join(tmpdir(), "flinch-browser-keeper-"));
  const payer = Keypair.generate();
  const keypairFile = join(directory, "payer.json");
  const configFile = join(directory, "keeper.json");
  const journalDirectory = resolve(stack.directory, "browser-keeper");
  let service: ReturnType<typeof startKeeperProcess> | undefined;
  try {
    await sendClient(stack, stack.base, [SystemProgram.transfer({ fromPubkey: stack.host.publicKey, toPubkey: payer.publicKey, lamports: 100_000_000n })],
      [stack.host], "fund separate browser keeper payer");
    await writeFile(keypairFile, JSON.stringify([...payer.secretKey]), { mode: 0o600 });
    await writeFile(configFile, JSON.stringify({ version: 1, network: "localnet", expectedGenesis: await stack.base.getGenesisHash(),
      baseUrl: stack.base.rpcEndpoint, localErUrl: stack.er.rpcEndpoint, rooms: [room.toBase58()], journalDirectory,
      keypairFile, payer: payer.publicKey.toBase58(), concurrency: 1 }), { mode: 0o600 });
    service = startKeeperProcess(configFile, stack.directory);
    await service.ready();
    const running = service;
    return {
      pid: running.child.pid,
      check: () => {
        assert.equal(running.child.exitCode, null, JSON.stringify(running.events));
        assert.equal(running.child.signalCode, null, "browser keeper stopped unexpectedly");
      },
      capture: async () => {
        const history = await new FileOperationStore(journalDirectory).history(room.toBase58());
        const operations = [...new Map(history.map(op => [op.signature, op])).values()];
        assert.equal(operations.filter(op => op.action === "execute").length, 2);
        for (const op of operations) {
          await captureTransaction(stack, op.runtime === "er" ? stack.er : stack.base, op.signature, `browser keeper ${op.action}`);
          if (op.returnSignature) await captureTransaction(stack, stack.base, op.returnSignature, "browser keeper base return");
        }
      },
      stop: async () => { await running.stop(); await rm(directory, { recursive: true, force: true }); }
    };
  } catch (error) {
    await service?.stop();
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}
