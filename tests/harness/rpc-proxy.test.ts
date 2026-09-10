import { test } from "node:test";
import assert from "node:assert/strict";
import anchor from "@coral-xyz/anchor";
import { Connection, Keypair, SystemProgram, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import type { TransactionInstruction } from "@solana/web3.js";
import { createProgram } from "../../packages/client/src/program.ts";
import { controlInstructions } from "../../packages/client/src/instructions/control.ts";
import { executeInstruction } from "../../packages/client/src/instructions/settlement.ts";
import { receiptAddress } from "../../packages/client/src/addresses.ts";
import { describeSubmission } from "../stack/rpc-proxy.ts";

const key = () => Keypair.generate().publicKey;
const payer = Keypair.generate();
const program = createProgram(new Connection("http://127.0.0.1:8899"));

function request(instructions: TransactionInstruction[], version: "legacy" | "v0" = "legacy") {
  const message = new TransactionMessage({ payerKey: payer.publicKey, recentBlockhash: key().toBase58(), instructions });
  const transaction = new VersionedTransaction(version === "legacy" ? message.compileToLegacyMessage() : message.compileToV0Message());
  transaction.sign([payer]);
  return { rpc: { method: "sendTransaction", params: [Buffer.from(transaction.serialize()).toString("base64"), { encoding: "base64" }] },
    signature: anchor.utils.bytes.bs58.encode(transaction.signatures[0]) };
}

test("proxy derives real settlement receipts from the generated instruction for both static message formats", async () => {
  const ledger = key();
  const pool = { pool: key(), ammConfig: key(), authority: key(), poolWsolVault: key(), poolUsdcVault: key(), observation: key() };
  for (const version of ["legacy", "v0"] as const) {
    const fixture = request([await executeInstruction(program, ledger, 3n, payer.publicKey, pool)], version);
    const description = describeSubmission(fixture.rpc);
    assert.deepEqual(description, { signature: fixture.signature, payer: payer.publicKey.toBase58(), action: "execute_batch",
      receipt: receiptAddress(ledger, 3n).toBase58() });
    assert(!JSON.stringify(description).includes(fixture.rpc.params[0] as string));
    assert(!JSON.stringify(description).includes(Buffer.from(payer.secretKey).toString("base64")));
  }
});

test("proxy distinguishes expire and non-receipt instructions and ignores unrelated RPCs", async () => {
  const ledger = key();
  const control = controlInstructions(program);
  assert.equal(describeSubmission(request([await control.expire(ledger, 1n, payer.publicKey)]).rpc)?.action, "expire_batch");
  assert.deepEqual(describeSubmission(request([await control.freeze(ledger, payer.publicKey)]).rpc)?.receipt, undefined);
  assert.equal(describeSubmission({ method: "simulateTransaction", params: [] }), undefined);
  assert.equal(describeSubmission(request([SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: key(), lamports: 1 })]).rpc), undefined);
  assert.throws(() => describeSubmission({ method: "sendTransaction", params: ["x".repeat(2049)] }));
  assert.throws(() => describeSubmission({ method: "sendTransaction", params: ["invalid"] }));
});
