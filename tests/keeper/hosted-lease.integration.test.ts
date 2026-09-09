import { test } from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";
import { once } from "node:events";
import { setTimeout } from "node:timers/promises";
import { acquireHostedLease } from "../../apps/keeper/src/hosted-lease.ts";

const url = process.env.FLINCH_TEST_DATABASE_URL;

test("hosted lease serializes keepers and aborts its owner if the database session disappears", { skip: !url }, async () => {
  if (new URL(url!).pathname !== "/flinch_test") throw new Error("Integration tests require the dedicated flinch_test database");
  const firstAbort = new AbortController();
  const secondAbort = new AbortController();
  const first = await acquireHostedLease(url!, firstAbort);
  let second: Awaited<ReturnType<typeof acquireHostedLease>> | undefined;
  const waiting = acquireHostedLease(url!, secondAbort).then(value => { second = value; return value; });
  const sql = postgres(url!, { max: 1, onnotice: () => {} });
  try {
    await setTimeout(600);
    assert.equal(second, undefined);
    await first.close();
    const next = await waiting;
    assert.notEqual(next.pid, first.pid);
    await sql`SELECT pg_terminate_backend(${next.pid})`;
    if (!secondAbort.signal.aborted) await once(secondAbort.signal, "abort", { signal: AbortSignal.timeout(7000) });
    assert(secondAbort.signal.aborted);
  } finally {
    firstAbort.abort(); secondAbort.abort();
    await first.close(); await second?.close(); await sql.end();
    await waiting.catch(() => {});
  }
});
