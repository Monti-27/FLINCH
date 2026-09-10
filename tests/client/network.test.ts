import { test } from "node:test";
import assert from "node:assert/strict";
import { endpoint, verifyNetwork, DEVNET_GENESIS } from "../../packages/client/src/network.ts";

test("network policy rejects cross-network and misleading endpoint addresses", () => {
  assert.equal(endpoint("http://127.0.0.1:7799", "localnet", true), "http://127.0.0.1:7799/");
  assert.equal(endpoint("https://devnet-as.magicblock.app", "devnet", true), "https://devnet-as.magicblock.app/");
  for (const url of ["http://devnet-as.magicblock.app", "https://magicblock.app.evil.test", "https://evilmagicblock.app",
    "https://user:password@devnet-as.magicblock.app", "https://devnet-as.magicblock.app?key=abc", "https://127.0.0.1"]) {
    assert.throws(() => endpoint(url, "devnet", true));
  }
  assert.throws(() => endpoint("https://devnet-as.magicblock.app", "localnet"));
});

test("genesis validation prevents wrong-cluster execution", async () => {
  await verifyNetwork({ getGenesisHash: async () => DEVNET_GENESIS }, "devnet", DEVNET_GENESIS);
  await assert.rejects(verifyNetwork({ getGenesisHash: async () => "another-chain" }, "devnet", DEVNET_GENESIS));
  await assert.rejects(verifyNetwork({ getGenesisHash: async () => "another-chain" }, "devnet", "another-chain"));
});
