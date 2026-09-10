import { test } from "node:test";
import assert from "node:assert/strict";
import anchor from "@coral-xyz/anchor";
import { Connection, Keypair, TransactionInstruction, TransactionMessage } from "@solana/web3.js";
import type { VersionedTransactionResponse } from "@solana/web3.js";
import { PROGRAM_ID, createProgram } from "../../packages/client/src/program.ts";
import { returnedControl, findReturnProof } from "../../packages/client/src/commitment.ts";

const base = new Connection("http://127.0.0.1:8899");
const control = Keypair.generate().publicKey;

function fixture(writable = true): VersionedTransactionResponse {
  const data = new anchor.BorshInstructionCoder(createProgram(base).idl).encode("processUndelegation", { accountSeeds: [Buffer.from("control-v2")] });
  const message = new TransactionMessage({ payerKey: Keypair.generate().publicKey, recentBlockhash: Keypair.generate().publicKey.toBase58(),
    instructions: [new TransactionInstruction({ programId: PROGRAM_ID, data, keys: [{ pubkey: control, isSigner: false, isWritable: writable }] })] }).compileToV0Message();
  const ix = message.compiledInstructions[0];
  return { slot: 12, transaction: { message, signatures: ["test"] }, meta: { err: null, fee: 5000,
    preBalances: [], postBalances: [], innerInstructions: [{ index: 0, instructions: [{ programIdIndex: ix.programIdIndex,
      accounts: ix.accountKeyIndexes, data: anchor.utils.bytes.bs58.encode(ix.data) }] }] } };
}

test("base return proof requires a successful callback for the exact writable Control", () => {
  assert(returnedControl(fixture(), control, base));
  assert(!returnedControl(fixture(false), control, base));
  assert(!returnedControl(fixture(), Keypair.generate().publicKey, base));
  const failed = fixture();
  failed.meta!.err = { InstructionError: [0, "InvalidArgument"] };
  assert(!returnedControl(failed, control, base));
  const otherProgram = fixture();
  otherProgram.meta!.innerInstructions![0].instructions[0].programIdIndex = 0;
  assert(!returnedControl(otherProgram, control, base));
  const missing = fixture();
  missing.meta!.innerInstructions = [];
  assert(!returnedControl(missing, control, base));
});

test("proof lookup excludes later, failed and inconsistent transaction slots", async () => {
  const tx = fixture();
  base.getSignaturesForAddress = async () => [{ signature: "later", slot: 13, err: null, memo: null },
    { signature: "failed", slot: 12, err: { InstructionError: [0, "InvalidArgument"] }, memo: null },
    { signature: "returned", slot: 12, err: null, memo: null }];
  base.getTransaction = (async (signature: string) => { assert.equal(signature, "returned"); return tx; }) as Connection["getTransaction"];
  assert.deepEqual(await findReturnProof(base, control, 12), { signature: "returned", slot: 12 });
  assert.equal(await findReturnProof(base, control, 11), undefined);
  tx.slot = 13;
  assert.equal(await findReturnProof(base, control, 12), undefined);
});
