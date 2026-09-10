import { test } from "node:test";
import assert from "node:assert/strict";
import { DEVNET_GENESIS, ClientError } from "../../packages/client/src/index.ts";
import { parseConfig } from "../../apps/keeper/src/runtime/config.ts";
import { errorCode, KeeperError } from "../../apps/keeper/src/runtime/errors.ts";
import { runKeeper } from "../../apps/keeper/src/runtime/service.ts";
import { key } from "./fixtures.ts";

const config = () => ({ version: 1, network: "devnet", expectedGenesis: DEVNET_GENESIS,
  baseUrl: "https://rpc.magicblock.app/devnet", rooms: [key().toBase58()], journalDirectory: "/tmp/flinch-public-journal" });

test("keeper configuration has explicit rooms, chain and bounded execution defaults", () => {
  const value = config();
  const parsed = parseConfig(value);
  assert.equal(parsed.rooms[0].toBase58(), value.rooms[0]);
  assert.equal(parsed.concurrency, 4);
  assert.equal(parsed.messageVersion, "v0");
  assert.equal(parsed.keypairFile, undefined);
  assert(Object.isFrozen(parsed));
  assert(Object.isFrozen(parsed.rooms));
  assert.equal(parseConfig({ ...value, network: "localnet", expectedGenesis: key().toBase58(),
    baseUrl: "http://127.0.0.1:8899", localErUrl: "http://127.0.0.1:7799" }).messageVersion, "legacy");
});

test("keeper rejects ambiguous, secret-bearing or unsupported configuration", () => {
  const value = config();
  for (const change of [{ version: 2 }, { network: "mainnet" }, { expectedGenesis: key().toBase58() },
    { baseUrl: "http://rpc.magicblock.app/devnet" }, { baseUrl: "https://token:password@rpc.magicblock.app/devnet" },
    { baseUrl: "https://rpc.magicblock.app/devnet?api-key=hidden" }, { localErUrl: "https://devnet-as.magicblock.app" },
    { rooms: [] }, { rooms: [value.rooms[0], value.rooms[0]] }, { rooms: Array.from({ length: 129 }, () => key().toBase58()) },
    { concurrency: 0 }, { concurrency: 5 }, { concurrency: 1.5 }, { messageVersion: "automatic" },
    { journalDirectory: "/tmp/.." }, { journalDirectory: "relative" }, { keypairFile: "/tmp/key.json" },
    { privateKey: "must not echo me" }, { payer: key().toBase58() }]) {
    assert.throws(() => parseConfig({ ...value, ...change }), { message: "invalid_config" });
  }
  assert.throws(() => parseConfig({ ...value, network: "localnet", baseUrl: "http://127.0.0.1:8899" }));
});

test("execution requires an explicit flag and signer before filesystem or network work", async () => {
  const value = parseConfig(config());
  const report = () => assert.fail("no report before authorization");
  await assert.rejects(runKeeper(value, false, report, new AbortController().signal), { message: "execution_required" });
  await assert.rejects(runKeeper(value, true, report, new AbortController().signal), { message: "execution_required" });
});

test("operational reporting emits only known error codes, never raw RPC or file errors", () => {
  assert.equal(errorCode(new KeeperError("unsafe_file")), "unsafe_file");
  assert.equal(errorCode(new ClientError("placement_pending", "private diagnostic")), "placement_pending");
  assert.equal(errorCode(new Error("https://user:password@example.com?api-key=hidden")), "operation_failed");
  assert.equal(errorCode({ code: "secret", message: "secret" }), "operation_failed");
});
