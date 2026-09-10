import { test } from "node:test";
import assert from "node:assert/strict";
import { ComputeBudgetInstruction, ComputeBudgetProgram, Keypair, SystemProgram, Transaction, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { prepareTransaction, submitTransaction } from "../../packages/client/src/transactions.ts";
import type { TransactionSigner } from "../../packages/client/src/transactions.ts";

const wallet = Keypair.generate();
const recipient = Keypair.generate().publicKey;
const latest = { blockhash: Keypair.generate().publicKey.toBase58(), lastValidBlockHeight: 42 };
const rpc = { getLatestBlockhash: async () => latest };
const instruction = SystemProgram.transfer({ fromPubkey: wallet.publicKey, toPubkey: recipient, lamports: 1n });
const signer: TransactionSigner = { publicKey: wallet.publicKey, sign: async tx => { tx.sign([wallet]); return tx; } };
const unpack = (tx: VersionedTransaction) => TransactionMessage.decompile(tx.message).instructions;
const budgetType = (ix: TransactionInstruction) => ix.programId.equals(ComputeBudgetProgram.programId)
  ? ComputeBudgetInstruction.decodeInstructionType(ix) : undefined;

function rebuild(tx: VersionedTransaction, instructions = unpack(tx)) {
  const args = { payerKey: wallet.publicKey, recentBlockhash: tx.message.recentBlockhash, instructions };
  return new VersionedTransaction(tx.version === "legacy"
    ? new Transaction({ feePayer: args.payerKey, recentBlockhash: args.recentBlockhash }).add(...instructions).compileMessage()
    : new TransactionMessage(args).compileToV0Message());
}

for (const version of ["legacy", "v0"] as const) {
  test(`${version} fixes the budget before preview and a fee-enhancing wallet signs the same message`, async () => {
    let previews = 0;
    let enhancements = 0;
    let expected: Uint8Array | undefined;
    const enhanced: TransactionSigner = { publicKey: wallet.publicKey, sign: async tx => {
      const instructions = unpack(tx);
      if (!instructions.some(ix => budgetType(ix) === "SetComputeUnitPrice" || budgetType(ix) === "SetComputeUnitLimit")) {
        enhancements++;
        instructions.unshift(ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1_000n }));
      }
      const result = rebuild(tx, instructions);
      result.sign([wallet]);
      return result;
    } };
    const prepared = await prepareTransaction(rpc, [instruction], enhanced, version, async tx => {
      previews++;
      expected = tx.message.serialize();
    });
    assert.equal(previews, 1);
    assert.equal(enhancements, 0);
    assert.deepEqual(prepared.transaction.message.serialize(), expected);
    const instructions = unpack(prepared.transaction);
    assert.deepEqual(instructions.map(budgetType), ["SetComputeUnitLimit", "SetComputeUnitPrice", undefined]);
    assert.equal(ComputeBudgetInstruction.decodeSetComputeUnitLimit(instructions[0]).units, 200_000);
    assert.equal(ComputeBudgetInstruction.decodeSetComputeUnitPrice(instructions[1]).microLamports, 0n);
    assert.deepEqual(instructions[2], instruction);
  });
}

test("explicit compute settings are retained exactly without duplicates", async () => {
  const limit = ComputeBudgetProgram.setComputeUnitLimit({ units: 450_000 });
  const price = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 12_345n });
  const heap = ComputeBudgetProgram.requestHeapFrame({ bytes: 32_768 });
  const original = [limit, price, heap, instruction];
  const prepared = await prepareTransaction(rpc, original, signer, "legacy");
  assert.deepEqual(unpack(prepared.transaction), original);
  assert.equal(original.length, 4);
});

test("partial budgets receive only their missing setting", async () => {
  for (const existing of [ComputeBudgetProgram.setComputeUnitLimit({ units: 350_000 }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5n })]) {
    const prepared = await prepareTransaction(rpc, [existing, instruction], signer);
    const instructions = unpack(prepared.transaction);
    assert.equal(instructions.filter(ix => budgetType(ix) === "SetComputeUnitLimit").length, 1);
    assert.equal(instructions.filter(ix => budgetType(ix) === "SetComputeUnitPrice").length, 1);
    assert.deepEqual(instructions.find(ix => budgetType(ix) === budgetType(existing)), existing);
  }
});

test("default compute allowance scales with application instructions and is capped", async () => {
  for (const [count, units] of [[3, 600_000], [9, 1_400_000]]) {
    const prepared = await prepareTransaction(rpc, Array.from({ length: count }, () => instruction), signer);
    assert.equal(ComputeBudgetInstruction.decodeSetComputeUnitLimit(unpack(prepared.transaction)[0]).units, units);
  }
});

test("duplicate or malformed compute settings reject before preview or signing", async () => {
  let signatures = 0;
  let previews = 0;
  const limited = { ...signer, sign: async (tx: VersionedTransaction) => { signatures++; return signer.sign(tx); } };
  const limit = ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 });
  const invalid = [
    [limit, limit],
    [ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 0n }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1n })],
    [ComputeBudgetProgram.setComputeUnitLimit({ units: 0 })],
    [ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_001 })],
    [new TransactionInstruction({ programId: ComputeBudgetProgram.programId, keys: [], data: Buffer.from([2]) })],
  ];
  for (const prefix of invalid) await assert.rejects(prepareTransaction(rpc, [...prefix, instruction], limited, "legacy", async () => { previews++; }));
  assert.equal(signatures, 0);
  assert.equal(previews, 0);
});

test("adding budget overhead cannot prompt the wallet for an oversized packet", async () => {
  let signatures = 0;
  const large = new TransactionInstruction({ programId: recipient, keys: [], data: Buffer.alloc(1_050) });
  await assert.rejects(prepareTransaction(rpc, [large], { ...signer, sign: async tx => { signatures++; return signer.sign(tx); } }, "legacy"), /packet size/);
  assert.equal(signatures, 0);
});

test("wallet changes remain rejected with safe diagnostics and no submission", async () => {
  const changes: Array<[string, (tx: VersionedTransaction) => VersionedTransaction]> = [
    ["blockhash", tx => { tx.message.recentBlockhash = Keypair.generate().publicKey.toBase58(); return tx; }],
    ["compute budget", tx => rebuild(tx, [...unpack(tx).filter(ix => budgetType(ix) !== "SetComputeUnitPrice"), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1n })])],
    ["instructions", tx => rebuild(tx, [...unpack(tx), SystemProgram.transfer({ fromPubkey: wallet.publicKey, toPubkey: recipient, lamports: 99n })])],
  ];
  let sends = 0;
  for (const [category, mutate] of changes) {
    await assert.rejects(async () => {
      const prepared = await prepareTransaction(rpc, [instruction], { ...signer, sign: async tx => {
        const changed = mutate(tx);
        changed.sign([wallet]);
        return changed;
      } }, "legacy");
      await submitTransaction({ sendRawTransaction: async () => { sends++; return prepared.submission.signature; } }, prepared);
    }, error => {
      assert(error instanceof Error);
      assert.match(error.message, /Signer changed the transaction message/);
      assert.match(error.message, new RegExp(category));
      assert.match(error.message, /Nothing was submitted/);
      assert(!error.message.includes(wallet.publicKey.toBase58()));
      return true;
    });
  }
  assert.equal(sends, 0);
});

test("a preview cannot change the message that reaches the wallet", async () => {
  let signatures = 0;
  await assert.rejects(prepareTransaction(rpc, [instruction], { ...signer, sign: async tx => { signatures++; return signer.sign(tx); } }, "legacy", async tx => {
    tx.message.recentBlockhash = Keypair.generate().publicKey.toBase58();
  }), /preview/i);
  assert.equal(signatures, 0);
});

test("legacy wallet roundtrips retain every required session signature", async () => {
  const session = Keypair.generate();
  const cosigned = new TransactionInstruction({ programId: recipient, data: Buffer.from([1]), keys: [
    { pubkey: session.publicKey, isSigner: true, isWritable: false },
    { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
  ] });
  const prepared = await prepareTransaction(rpc, [cosigned], { ...signer, sign: async tx => {
    tx.sign([session]);
    const roundtrip = Transaction.from(tx.serialize());
    roundtrip.partialSign(wallet);
    assert(roundtrip.verifySignatures());
    return VersionedTransaction.deserialize(roundtrip.serialize());
  } }, "legacy");
  assert.equal(prepared.transaction.signatures.length, 2);
});
