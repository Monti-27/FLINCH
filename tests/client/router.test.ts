import { test } from "node:test";
import assert from "node:assert/strict";
import { Keypair } from "@solana/web3.js";
import { DevnetRouter } from "../../packages/client/src/routing/router.ts";
import { DEVNET_PROGRAM_ID as PROGRAM_ID } from "../../packages/client/src/program.ts";
import type { RpcRequest } from "../../packages/client/src/routing/rpc.ts";

const control = Keypair.generate().publicKey;
const validator = Keypair.generate().publicKey;
const valid = () => ({ isDelegated: true, fqdn: "https://devnet-as.magicblock.app/",
  delegationRecord: { authority: validator.toBase58(), owner: PROGRAM_ID.toBase58(), delegationSlot: 42, lamports: 1 } });

test("router uses the documented account-specific method and validates placement", async () => {
  const request: RpcRequest = async (url, method, params) => {
    assert.equal(url, "https://devnet-router.magicblock.app/");
    assert.equal(method, "getDelegationStatus");
    assert.deepEqual(params, [control.toBase58()]);
    return valid();
  };
  const placement = await new DevnetRouter(undefined, request).resolve(control, validator);
  assert(placement.validator.equals(validator));
  assert.equal(placement.delegationSlot, 42);
});

test("router rejects missing, stale, wrong-authority and unsafe placement responses", async () => {
  const responses = [null, {}, { isDelegated: false }, { isDelegated: true },
    { ...valid(), fqdn: "https://magicblock.app.evil.test" },
    { ...valid(), delegationRecord: { ...valid().delegationRecord, authority: PROGRAM_ID.toBase58() } },
    { ...valid(), delegationRecord: { ...valid().delegationRecord, owner: validator.toBase58() } },
    { ...valid(), delegationRecord: { ...valid().delegationRecord, delegationSlot: -1 } }];
  for (const response of responses) await assert.rejects(new DevnetRouter(undefined, async () => response).resolve(control, validator));
});
