import postgres from "postgres";
import { PublicKey } from "@solana/web3.js";
import { appendOperation, validateOperation } from "./operation.ts";
import type { Operation, OperationStore } from "./store.ts";

export function decodeHistory(value: unknown, room: string): readonly Operation[] {
  if (!Array.isArray(value) || value.length > 2048 || Buffer.byteLength(JSON.stringify(value)) > 2_097_152) {
    throw new Error("Invalid operation history");
  }
  let history: readonly Operation[] = [];
  for (const record of value) history = appendOperation(history, validateOperation(record, room));
  return history;
}

export class PostgresOperationStore implements OperationStore {
  private readonly sql: postgres.Sql;

  constructor(url: string) {
    const parsed = new URL(url);
    if (!["postgres:", "postgresql:"].includes(parsed.protocol) || !parsed.hostname || !parsed.pathname.slice(1)) {
      throw new Error("Invalid database configuration");
    }
    this.sql = postgres(url, { max: 4, connect_timeout: 5, idle_timeout: 20, onnotice: () => {},
      connection: { application_name: "flinch-keeper", statement_timeout: 5000, lock_timeout: 4000 } });
  }

  async migrate() {
    await this.sql.begin(async sql => {
      await sql`SELECT pg_advisory_xact_lock(1179404622, 1)`;
      await sql`CREATE TABLE IF NOT EXISTS keeper_journals (
        room TEXT PRIMARY KEY,
        history JSONB NOT NULL CHECK (jsonb_typeof(history) = 'array' AND jsonb_array_length(history) BETWEEN 1 AND 2048),
        status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'failed', 'superseded')),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CHECK (octet_length(history::text) <= 2097152)
      )`;
      await sql`CREATE INDEX IF NOT EXISTS keeper_pending_rooms ON keeper_journals (room) WHERE status = 'pending'`;
    });
  }

  async health() {
    await this.sql`SELECT room FROM keeper_journals LIMIT 0`;
  }

  async history(room: string): Promise<readonly Operation[]> {
    if (new PublicKey(room).toBase58() !== room) throw new Error("Invalid journal room");
    const rows = await this.sql`SELECT history FROM keeper_journals WHERE room = ${room}`;
    return rows.length ? decodeHistory(rows[0].history, room) : [];
  }

  async get(room: string) { return (await this.history(room)).at(-1) ?? null; }

  async pendingRooms() {
    const rows = await this.sql`SELECT room FROM keeper_journals WHERE status = 'pending' ORDER BY room LIMIT 129`;
    if (rows.length > 128) throw new Error("Too many pending rooms to resume safely");
    return rows.map(row => new PublicKey(row.room));
  }

  async put(operation: Operation) {
    const next = validateOperation(operation, operation.room);
    await this.sql.begin(async sql => {
      await sql`SELECT pg_advisory_xact_lock(hashtextextended(${next.room}, 0))`;
      const rows = await sql`SELECT history FROM keeper_journals WHERE room = ${next.room} FOR UPDATE`;
      const previous = rows.length ? decodeHistory(rows[0].history, next.room) : [];
      const history = appendOperation(previous, next);
      const serialized = JSON.stringify(history);
      if (Buffer.byteLength(serialized) > 2_097_152) throw new Error("Operation journal is too large");
      await sql`INSERT INTO keeper_journals (room, history, status) VALUES (${next.room}, ${sql.json(JSON.parse(serialized))}, ${next.status})
        ON CONFLICT (room) DO UPDATE SET history = EXCLUDED.history, status = EXCLUDED.status, updated_at = now()`;
    });
  }

  async close() { await this.sql.end({ timeout: 5 }); }
}
