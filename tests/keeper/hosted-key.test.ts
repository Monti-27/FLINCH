import { test } from "node:test";
import assert from "node:assert/strict";
import { stat, access } from "node:fs/promises";
import { Keypair } from "@solana/web3.js";
import { hostedKey } from "../../apps/keeper/src/hosted-key.ts";
import { loadSigner } from "../../apps/keeper/src/runtime/signer.ts";

test("hosted key is private, identity checked, removed from environment and cleaned up", async () => {
  const wallet = Keypair.generate();
  const env = { FLINCH_KEEPER_SECRET: JSON.stringify(Array.from(wallet.secretKey)), FLINCH_KEEPER_EXECUTE: "true",
    FLINCH_KEEPER_PAYER: wallet.publicKey.toBase58() };
  const key = await hostedKey(env);
  assert.equal(env.FLINCH_KEEPER_SECRET, undefined);
  try {
    assert.equal((await stat(key.path!)).mode & 0o777, 0o600);
    assert((await loadSigner(key.path!, wallet.publicKey)).publicKey.equals(wallet.publicKey));
  } finally { await key.close(); }
  await assert.rejects(access(key.path!));
});

test("hosted key rejects disabled execution, ambiguous sources, malformed keys and wrong identity", async () => {
  const wallet = Keypair.generate();
  const env = { FLINCH_KEEPER_SECRET: JSON.stringify(Array.from(wallet.secretKey)), FLINCH_KEEPER_EXECUTE: "true",
    FLINCH_KEEPER_PAYER: wallet.publicKey.toBase58() };
  for (const changes of [{ FLINCH_KEEPER_EXECUTE: "false" }, { FLINCH_KEEPER_KEYPAIR_FILE: "/tmp/key" },
    { FLINCH_KEEPER_SECRET: "[]" }, { FLINCH_KEEPER_SECRET: "malformed" }, { FLINCH_KEEPER_SECRET: "x".repeat(4097) },
    { FLINCH_KEEPER_PAYER: Keypair.generate().publicKey.toBase58() }]) await assert.rejects(hostedKey({ ...env, ...changes }));
});
