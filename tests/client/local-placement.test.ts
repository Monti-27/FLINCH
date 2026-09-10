import { test } from "node:test";
import assert from "node:assert/strict";
import { Keypair } from "@solana/web3.js";
import { DELEGATION_PROGRAM_ID, delegationRecordPdaFromDelegatedAccount } from "@magicblock-labs/ephemeral-rollups-sdk";
import { LocalPlacementResolver } from "../../packages/client/src/index.ts";

test("local resolver reads SDK-derived records and reports observation time, not a delegation slot", async () => {
  const control = Keypair.generate().publicKey;
  const validator = Keypair.generate().publicKey;
  const data = Buffer.alloc(40);
  validator.toBuffer().copy(data, 8);
  const resolver = new LocalPlacementResolver({ getAccountInfoAndContext: async address => {
    assert(address.equals(delegationRecordPdaFromDelegatedAccount(control)));
    return { context: { slot: 123 }, value: { owner: DELEGATION_PROGRAM_ID, lamports: 1, executable: false, data } };
  } }, "http://127.0.0.1:7799");
  const result = await resolver.resolve(control, validator);
  assert.equal(result.observedSlot, 123);
  assert(!("delegationSlot" in result));
  await assert.rejects(resolver.resolve(control, Keypair.generate().publicKey), /validator differs/);
  await assert.rejects(resolver.resolve(control, validator, AbortSignal.abort()));
  assert.throws(() => new LocalPlacementResolver({ getAccountInfoAndContext: async () => assert.fail() }, "https://devnet-as.magicblock.app"));
});

test("missing local delegation stays pending instead of selecting a fallback", async () => {
  const resolver = new LocalPlacementResolver({ getAccountInfoAndContext: async () => ({ context: { slot: 5 }, value: null }) }, "http://localhost:7799");
  await assert.rejects(resolver.resolve(Keypair.generate().publicKey, Keypair.generate().publicKey), /not yet visible/);
});
