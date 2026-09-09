import { test } from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";
import { PostgresOperationStore } from "../../apps/keeper/src/postgres-store.ts";
import { operation, snapshot } from "./fixtures.ts";

const url = process.env.FLINCH_TEST_DATABASE_URL;

test("PostgreSQL persists uncertain operations across restarts and rejects concurrent replacements", { skip: !url }, async () => {
  if (new URL(url!).pathname !== "/flinch_test") throw new Error("Integration tests require the dedicated flinch_test database");
  const sql = postgres(url!, { onnotice: () => {} });
  let store = new PostgresOperationStore(url!);
  const competitor = new PostgresOperationStore(url!);
  try {
    await store.migrate();
    await sql`TRUNCATE keeper_journals`;
    const op = operation(snapshot());
    assert.equal(await store.get(op.room), null);
    await store.put(op);
    await store.close();
    store = new PostgresOperationStore(url!);
    assert.deepEqual(await store.get(op.room), op);
    assert.deepEqual((await store.pendingRooms()).map(key => key.toBase58()), [op.room]);
    await assert.rejects(competitor.put({ ...op, signature: "1".repeat(64) }), /uncertain/);
    await Promise.all([store.put({ ...op, status: "confirmed" }), competitor.put({ ...op, status: "confirmed" })]);
    assert.equal((await store.history(op.room)).length, 2);
    assert.deepEqual(await store.pendingRooms(), []);
    await assert.rejects(store.put(op), /resolved/);
    const outcomes = await Promise.allSettled([store.put({ ...op, signature: "1".repeat(64) }),
      competitor.put({ ...op, signature: "2" + "1".repeat(87) })]);
    assert.equal(outcomes.filter(result => result.status === "fulfilled").length, 1);
    assert.equal((await store.history(op.room)).length, 3);
    await store.health();
  } finally {
    await sql`TRUNCATE keeper_journals`;
    await Promise.all([store.close(), competitor.close(), sql.end()]);
  }
});
