import { test } from "node:test";
import assert from "node:assert/strict";
import { Keypair, SystemProgram } from "@solana/web3.js";
import { prepareTransaction, submitTransaction, transactionStatus } from "../../packages/client/src/transactions.ts";
import type { TransactionSigner } from "../../packages/client/src/transactions.ts";

const wallet = Keypair.generate();
const latest = { blockhash: Keypair.generate().publicKey.toBase58(), lastValidBlockHeight: 42 };
const instruction = SystemProgram.transfer({ fromPubkey: wallet.publicKey, toPubkey: Keypair.generate().publicKey, lamports: 1n });
const signer: TransactionSigner = { publicKey: wallet.publicKey, sign: async transaction => { transaction.sign([wallet]); return transaction; } };

test("transaction builder binds signatures to the intended message and destination blockhash", async () => {
  const prepared = await prepareTransaction({ getLatestBlockhash: async () => latest }, [instruction], signer);
  assert.equal(prepared.transaction.message.recentBlockhash, latest.blockhash);
  let options;
  assert.equal(await submitTransaction({ sendRawTransaction: async (_, value) => { options = value; return prepared.submission.signature; } }, prepared), prepared.submission.signature);
  assert.equal(options!.skipPreflight, false);
  await assert.rejects(submitTransaction({ sendRawTransaction: async () => "different" }, prepared));
});

test("missing signatures and signer message mutation reject before submission", async () => {
  await assert.rejects(prepareTransaction({ getLatestBlockhash: async () => latest }, [instruction], { ...signer, sign: async tx => tx }));
  await assert.rejects(prepareTransaction({ getLatestBlockhash: async () => latest }, [instruction], { ...signer, sign: async tx => {
    tx.message.recentBlockhash = Keypair.generate().publicKey.toBase58();
    tx.sign([wallet]);
    return tx;
  } }));
});

test("RPC acceptance or processed status is never reported as confirmation", async () => {
  const read = async (confirmationStatus: "processed" | "confirmed", err: null | { BlockhashNotFound: null } = null) => transactionStatus({ getSignatureStatuses: async () => ({ context: { slot: 9 }, value: [{ slot: 9, confirmations: 1, err, confirmationStatus }] }) }, "signature");
  assert.deepEqual(await read("processed"), { kind: "pending" });
  assert.deepEqual(await read("confirmed"), { kind: "confirmed", slot: 9 });
  assert.equal((await read("confirmed", { BlockhashNotFound: null })).kind, "failed");
  assert.deepEqual(await transactionStatus({ getSignatureStatuses: async () => ({ context: { slot: 1 }, value: [null] }) }, "signature"), { kind: "pending" });
});

test("a rejected preview never requests a wallet signature", async () => {
  let signatures = 0;
  await assert.rejects(prepareTransaction({ getLatestBlockhash: async () => latest }, [instruction], { ...signer,
    sign: async tx => { signatures++; return signer.sign(tx); } }, "legacy", async () => { throw new Error("preview rejected"); }), /preview rejected/);
  assert.equal(signatures, 0);
});
