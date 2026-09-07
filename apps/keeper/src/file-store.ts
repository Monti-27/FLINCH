import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { mkdir, open, rename, unlink, opendir } from "node:fs/promises";
import { resolve } from "node:path";
import { PublicKey } from "@solana/web3.js";
import type { Operation, OperationStore } from "./store.ts";

import { appendOperation, validateOperation } from "./operation.ts";

export class FileOperationStore implements OperationStore {
  private readonly directory: string;
  private readonly writes = new Map<string, Promise<void>>();
  constructor(directory: string) { this.directory = resolve(directory); }
  private path(room: string) { return resolve(this.directory, `${new PublicKey(room).toBase58()}.json`); }

  async get(room: string): Promise<Operation | null> { return (await this.history(room)).at(-1) ?? null; }

  async pendingRooms(): Promise<PublicKey[]> {
    const pending: PublicKey[] = [];
    let count = 0;
    try {
      const directory = await opendir(this.directory);
      for await (const entry of directory) {
        if (++count > 4096) throw new Error("Operation directory exceeds the demo limit");
        if (!entry.name.endsWith(".json")) continue;
        const room = new PublicKey(entry.name.slice(0, -5));
        if (`${room.toBase58()}.json` !== entry.name) throw new Error("Invalid journal name");
        if ((await this.get(room.toBase58()))?.status === "pending") pending.push(room);
        if (pending.length > 128) throw new Error("Too many pending rooms to resume safely");
      }
    } catch (error) {
      if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") throw error;
    }
    return pending;
  }

  async history(room: string): Promise<readonly Operation[]> {
    try {
      const file = await open(this.path(room), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      let data: unknown;
      try {
        const stat = await file.stat();
        if (!stat.isFile() || stat.nlink !== 1 || (stat.mode & 0o077) !== 0 || stat.uid !== process.getuid?.()) throw new Error("Unsafe operation journal");
        if (stat.size > 2_097_152) throw new Error("Operation journal is too large");
        data = JSON.parse(await file.readFile("utf8"));
      } finally { await file.close(); }
      if (!data || typeof data !== "object" || !("version" in data) || data.version !== 1
        || !("operations" in data) || !Array.isArray(data.operations) || data.operations.length > 2048) throw new Error("Invalid operation history");
      let history: readonly Operation[] = [];
      for (const record of data.operations) history = appendOperation(history, validateOperation(record, room));
      return history;
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return [];
      throw error;
    }
  }

  async put(operation: Operation): Promise<void> {
    const next = validateOperation(operation, operation.room);
    const prior = this.writes.get(next.room) ?? Promise.resolve();
    const write = prior.catch(() => undefined).then(() => this.persist(next));
    this.writes.set(next.room, write);
    try { await write; } finally { if (this.writes.get(next.room) === write) this.writes.delete(next.room); }
  }

  private async persist(operation: Operation): Promise<void> {
    const operations = appendOperation(await this.history(operation.room), operation);
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const path = this.path(operation.room);
    const temporary = `${path}.${randomUUID()}.tmp`;
    try {
      const file = await open(temporary, "wx", 0o600);
      try { await file.writeFile(JSON.stringify({ version: 1, operations })); await file.sync(); } finally { await file.close(); }
      await rename(temporary, path);
      const directory = await open(this.directory, "r");
      try { await directory.sync(); } finally { await directory.close(); }
    } finally {
      await unlink(temporary).catch(error => { if (error.code !== "ENOENT") throw error; });
    }
  }
}
