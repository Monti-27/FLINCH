import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeHistory, PostgresOperationStore } from "../../apps/keeper/src/postgres-store.ts";
import { hostedConfig } from "../../apps/keeper/src/hosted-config.ts";
import { operation, snapshot } from "./fixtures.ts";

test("database history retains replay and public-field validation", () => {
  const op = operation(snapshot());
  assert.deepEqual(decodeHistory([op, { ...op, status: "confirmed" }], op.room), [op, { ...op, status: "confirmed" }]);
  assert.throws(() => decodeHistory([op, { ...op, signature: "1".repeat(64) }], op.room), /uncertain/);
  assert.throws(() => decodeHistory([{ ...op, privateKey: "forbidden" }], op.room));
  assert.throws(() => decodeHistory({}, op.room));
  assert.throws(() => new PostgresOperationStore("https://example.com/db"));
});

test("hosted deployment defaults to non-signing devnet and rejects unsafe activation", () => {
  const env = { DATABASE_URL: "postgres://localhost/flinch_test", FLINCH_POOL: snapshot().ledger.pool.toBase58(),
    FLINCH_VALIDATOR: snapshot().ledger.validator.toBase58() };
  const config = hostedConfig(env);
  assert.equal(config.execute, false);
  assert.equal(config.config.network, "devnet");
  assert.equal(config.config.keypairFile, undefined);
  assert.deepEqual(hostedConfig({ ...env, FLINCH_PREVIOUS_BASE_RPC: "https://rpc.magicblock.app/devnet" }).config.previousBaseUrls,
    ["https://rpc.magicblock.app/devnet"]);
  for (const changes of [{ PORT: "0" }, { PORT: "invalid" }, { FLINCH_KEEPER_EXECUTE: "yes" },
    { FLINCH_KEEPER_EXECUTE: "true" }, { FLINCH_BASE_RPC: "http://localhost:8899" }, { DATABASE_URL: "" },
    { FLINCH_PREVIOUS_BASE_RPC: "https://example.com/?api-key=secret" }, { FLINCH_PREVIOUS_BASE_RPC: "http://localhost:8899" }]) {
    assert.throws(() => hostedConfig({ ...env, ...changes }));
  }
});
