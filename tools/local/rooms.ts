import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PublicKey } from "@solana/web3.js";
import type { FlinchClient } from "../../packages/client/src/index.ts";
import type { Stack } from "../../tests/stack/bootstrap.ts";
import { startKeeperProcess } from "../../tests/stack/service-process.ts";
import type { KeeperProcess } from "../../tests/stack/service-process.ts";

export class LocalRooms {
  private readonly running = new Map<string, KeeperProcess>();
  private readonly stack: Stack;
  private readonly client: FlinchClient;
  private readonly secrets: string;
  private readonly payer: PublicKey;
  private readonly validator: PublicKey;

  constructor(stack: Stack, client: FlinchClient, secrets: string, payer: PublicKey, validator: PublicKey) {
    this.stack = stack; this.client = client; this.secrets = secrets; this.payer = payer; this.validator = validator;
  }

  async watch(address: PublicKey) {
    const room = address.toBase58();
    const previous = this.running.get(room);
    if (previous) {
      this.check(previous);
      return { room, pid: previous.child.pid, alreadyWatching: true };
    }
    if (this.running.size >= 4) throw new Error("Pause a room before watching more than four at once");
    const state = await this.client.readRoom(address);
    if (!state.ledger.pool.equals(this.stack.pool.pool) || !state.ledger.validator.equals(this.validator)) throw new Error("Room does not belong to this local venue");
    const config = join(this.secrets, `${room}.json`);
    await writeFile(config, JSON.stringify({ version: 1, network: "localnet", baseUrl: this.stack.base.rpcEndpoint,
      expectedGenesis: this.client.config.expectedGenesis, localErUrl: this.stack.er.rpcEndpoint, rooms: [room],
      journalDirectory: join(this.stack.directory, "local-keeper", room), keypairFile: join(this.secrets, "payer.json"),
      payer: this.payer.toBase58(), concurrency: 1, messageVersion: "legacy" }), { mode: 0o600 });
    const process = startKeeperProcess(config, this.stack.directory);
    this.running.set(room, process);
    try { await process.ready(); } catch (error) {
      await process.stop();
      this.running.delete(room);
      throw error;
    }
    return { room, pid: process.child.pid, alreadyWatching: false };
  }

  async pause(address: PublicKey) {
    const room = address.toBase58();
    const running = this.running.get(room);
    if (running) { await running.stop(); this.running.delete(room); }
    return { room, paused: true };
  }

  status() {
    return [...this.running].map(([room, process]) => ({ room, pid: process.child.pid,
      running: process.child.exitCode === null && process.child.signalCode === null,
      latest: process.events.at(-1) }));
  }

  async stop() {
    const results = await Promise.allSettled([...this.running.keys()].map(room => this.pause(new PublicKey(room))));
    const failures = results.filter(result => result.status === "rejected");
    if (failures.length) throw new AggregateError(failures.map(result => result.reason), "Local keeper shutdown incomplete");
  }

  private check(process: KeeperProcess) {
    if (process.child.exitCode !== null || process.child.signalCode !== null) throw new Error("Keeper stopped; inspect status and journal before restarting");
  }
}
