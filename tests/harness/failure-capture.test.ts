import { test } from "node:test";
import assert from "node:assert/strict";
import { Connection, Keypair, SystemProgram, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { captureSubmissionFailure } from "../stack/failure-capture.ts";

function fixture() {
  const wallet = Keypair.generate();
  const message = new TransactionMessage({ payerKey: wallet.publicKey, recentBlockhash: Keypair.generate().publicKey.toBase58(),
    instructions: [SystemProgram.transfer({ fromPubkey: wallet.publicKey, toPubkey: Keypair.generate().publicKey, lamports: 1 })] }).compileToLegacyMessage();
  const transaction = new VersionedTransaction(message);
  transaction.sign([wallet]);
  const rpc = new Connection("http://127.0.0.1:8899");
  const failure = new Error("original preflight failure");
  rpc.sendRawTransaction = async () => { throw failure; };
  return { wallet, transaction, rpc, failure };
}

test("failure capture records public replay evidence but never signed bytes or keys", async () => {
  const { transaction, wallet, rpc, failure } = fixture();
  const events: unknown[] = [];
  rpc.getMultipleAccountsInfoAndContext = async keys => ({ context: { slot: 4 }, value: keys.map(() => null) });
  rpc.simulateTransaction = (async () => ({ context: { slot: 5 }, value: { err: "rejected", logs: ["replay log"] } })) as unknown as Connection["simulateTransaction"];
  captureSubmissionFailure(rpc, "unused", (name, value) => events.push({ name, value }));
  await assert.rejects(rpc.sendRawTransaction(transaction.serialize()), error => error === failure);
  assert.equal(events.length, 2);
  const recorded = JSON.stringify(events);
  assert(recorded.includes("failure-replay"));
  assert(!recorded.includes(Buffer.from(transaction.serialize()).toString("base64")));
  assert(!recorded.includes(Buffer.from(wallet.secretKey).toString("base64")));
});

test("capture and journal failures never replace the original submission error", async () => {
  for (const invalidBytes of [false, true]) {
    const { transaction, rpc, failure } = fixture();
    captureSubmissionFailure(rpc, "unused", () => { throw new Error("disk full"); });
    await assert.rejects(rpc.sendRawTransaction(invalidBytes ? new Uint8Array() : transaction.serialize()), error => error === failure);
  }
});
