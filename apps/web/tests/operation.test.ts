import { expect, it } from "vitest";
import { ComputeBudgetInstruction, ComputeBudgetProgram, Keypair, SystemProgram, Transaction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { DEVNET_GENESIS, prepareTransaction, SellNotSubmittedError } from "@flinch/client";
import type { FlinchClient, TransactionSigner } from "@flinch/client";
import { OperationRunner } from "../src/lib/operation.ts";
import { simulateBeforeSigning } from "../src/lib/preflight.ts";

async function fixture() {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const wallet = Keypair.generate();
  const signer: TransactionSigner = { publicKey: wallet.publicKey, sign: async tx => { tx.sign([wallet]); return tx; } };
  const prepared = await prepareTransaction({ getLatestBlockhash: async () => ({ blockhash: Keypair.generate().publicKey.toBase58(), lastValidBlockHeight: 4 }) },
    [SystemProgram.transfer({ fromPubkey: wallet.publicKey, toPubkey: wallet.publicKey, lamports: 0 })], signer);
  const client = { config: { network: "devnet", expectedGenesis: DEVNET_GENESIS }, base: { getGenesisHash: async () => DEVNET_GENESIS },
    status: async () => ({ kind: "pending" }) } as unknown as FlinchClient;
  const identity = { wallet: wallet.publicKey.toBase58(), room: Keypair.generate().publicKey.toBase58(), action: "Queue SELL", runtime: "er" as const };
  let sends = 0;
  const rpc = { rpcEndpoint: "https://devnet-as.magicblock.app/", sendRawTransaction: async () => { sends++; throw new Error("unknown network outcome"); } } as unknown as FlinchClient["base"];
  return { values, storage, wallet, prepared, client, identity, rpc, sends: () => sends };
}

it("persists public identity before send and blocks re-signing unknown work after reload", async () => {
  const f = await fixture();
  const runner = new OperationRunner(f.storage, "test");
  await expect(runner.run(f.client, f.identity, async () => ({ rpc: f.rpc, prepared: f.prepared }))).rejects.toThrow("unknown network outcome");
  expect(runner.current()?.status).toBe("pending");
  const reloaded = new OperationRunner(f.storage, "test");
  let prepares = 0;
  await expect(reloaded.run(f.client, f.identity, async () => { prepares++; return { rpc: f.rpc, prepared: f.prepared }; })).rejects.toThrow("still unconfirmed");
  expect(prepares).toBe(0);
  expect(f.sends()).toBe(1);
  expect(JSON.stringify([...f.values])).not.toContain(Buffer.from(f.wallet.secretKey).toString("base64"));
  expect(JSON.stringify([...f.values])).not.toContain(Buffer.from(f.prepared.transaction.serialize()).toString("base64"));
});

it("journal failures prevent submission and known-unsent quotes allow a fresh attempt", async () => {
  const f = await fixture();
  const runner = new OperationRunner({ ...f.storage, setItem: () => { throw new Error("storage unavailable"); } }, "blocked");
  await expect(runner.run(f.client, f.identity, async () => ({ rpc: f.rpc, prepared: f.prepared }))).rejects.toThrow("storage unavailable");
  expect(f.sends()).toBe(0);
  const live = new OperationRunner(f.storage, "test");
  await expect(live.run(f.client, f.identity, async () => ({ rpc: f.rpc, prepared: f.prepared }), async () => { throw new SellNotSubmittedError("Quote expired"); })).rejects.toThrow("expired");
  expect(live.current()?.status).toBe("not_sent");
  await expect(live.run(f.client, f.identity, async () => ({ rpc: f.rpc, prepared: f.prepared }))).rejects.toThrow("unknown network outcome");
  expect(f.sends()).toBe(1);
});

it("damaged public storage fails closed", async () => {
  const f = await fixture();
  f.values.set("test", JSON.stringify({ secret: "unexpected" }));
  const runner = new OperationRunner(f.storage, "test");
  await expect(runner.run(f.client, f.identity, async () => ({ rpc: f.rpc, prepared: f.prepared }))).rejects.toThrow("Invalid local transaction record");
  expect(f.sends()).toBe(0);
});

it("wallet-compatible preparation previews the final budget, journals before send and rejects wallet edits", async () => {
  const f = await fixture();
  const events: string[] = [];
  let previewed: Uint8Array | undefined;
  let alterFee = false;
  const rpc = f.rpc;
  rpc.getLatestBlockhash = async () => ({ blockhash: Keypair.generate().publicKey.toBase58(), lastValidBlockHeight: 42 });
  rpc.simulateTransaction = async tx => {
    if (!(tx instanceof VersionedTransaction)) throw new Error("Expected a compiled wallet transaction");
    events.push("preview");
    previewed = tx.message.serialize();
    const instructions = TransactionMessage.decompile(tx.message).instructions;
    expect(ComputeBudgetInstruction.decodeSetComputeUnitPrice(instructions[1]).microLamports).toBe(0n);
    return { context: { slot: 1 }, value: { err: null, logs: [] } };
  };
  const runner = new OperationRunner(f.storage, "wallet");
  rpc.sendRawTransaction = async () => {
    events.push("submit");
    expect(runner.current()?.status).toBe("pending");
    return runner.current()!.signature;
  };
  const signer: TransactionSigner = { publicKey: f.wallet.publicKey, sign: async tx => {
    events.push("sign");
    expect(tx.message.serialize()).toEqual(previewed);
    const walletTransaction = Transaction.from(tx.serialize());
    if (alterFee) walletTransaction.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1n }));
    walletTransaction.partialSign(f.wallet);
    return VersionedTransaction.deserialize(walletTransaction.serialize());
  } };
  const prepare = async () => ({ rpc, prepared: await prepareTransaction(rpc,
    [SystemProgram.transfer({ fromPubkey: f.wallet.publicKey, toPubkey: f.wallet.publicKey, lamports: 0n })],
    signer, "legacy", tx => simulateBeforeSigning(rpc, tx)) });
  const operation = await runner.run(f.client, f.identity, prepare);
  expect(events).toEqual(["preview", "sign", "submit"]);
  expect(operation.status).toBe("pending");
  const second = new OperationRunner(f.storage, "edited-wallet");
  alterFee = true;
  events.length = 0;
  await expect(second.run(f.client, f.identity, prepare)).rejects.toThrow(/compute budget/);
  expect(events).toEqual(["preview", "sign"]);
  expect(second.current()).toBeUndefined();
});
