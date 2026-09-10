import assert from "node:assert/strict";
import { resolve } from "node:path";
import type { Keypair, Connection, TransactionInstruction } from "@solana/web3.js";
import { ClientError, FlinchClient, LocalPlacementResolver, prepareTransaction, submitTransaction, transactionStatus } from "../../packages/client/src/index.ts";
import type { TransactionSigner } from "../../packages/client/src/index.ts";
import { RoomWorker, FileOperationStore } from "../../apps/keeper/src/index.ts";
import type { WorkerEvent } from "../../apps/keeper/src/index.ts";
import { journal, snapshot } from "./evidence.ts";
import { poll } from "./rpc.ts";
import type { Stack } from "./bootstrap.ts";
import { captureSubmissionFailure } from "./failure-capture.ts";

export const walletSigner = (wallets: Keypair[]): TransactionSigner => ({ publicKey: wallets[0].publicKey,
  sign: async transaction => { transaction.sign(wallets); return transaction; } });

export async function localClient(stack: Stack) {
  const client = new FlinchClient({ network: "localnet", baseUrl: stack.base.rpcEndpoint, expectedGenesis: await stack.base.getGenesisHash() },
    new LocalPlacementResolver(stack.base, stack.er.rpcEndpoint));
  captureSubmissionFailure(client.base, stack.directory);
  const read = client.readRoom.bind(client);
  client.readRoom = async (...args) => {
    const state = await read(...args);
    journal(stack.directory, "client-observations", { slot: state.slot, now: state.now.toString(), revision: state.ledger.economics?.revision.toString(),
      control: state.control.kind === "base" ? { kind: "base", phase: state.control.value.phase,
        revision: state.control.value.revision.toString(), sellers: state.control.value.sellers,
        holdings: state.control.value.holdings.map(String) } : state.control });
    return state;
  };
  return client;
}

export function keeper(client: FlinchClient, stack: Stack, name = "keeper") {
  const store = new FileOperationStore(resolve(stack.directory, name));
  const worker = new RoomWorker(client, walletSigner([stack.host]), store, { messageVersion: "legacy",
    onEvent: event => journal(stack.directory, "keeper-events", { worker: name, ...event }) });
  return { store, worker };
}

export async function tick(worker: RoomWorker, ledger: Parameters<RoomWorker["tick"]>[0]): Promise<WorkerEvent | undefined> {
  try { return await worker.tick(ledger); } catch (error) {
    if (error instanceof ClientError && error.code === "placement_pending") return;
    throw error;
  }
}

export async function sendClient(stack: Stack, rpc: Connection, instructions: TransactionInstruction[], wallets: Keypair[], label: string) {
  const prepared = await prepareTransaction(rpc, instructions, walletSigner(wallets), "legacy");
  journal(stack.directory, "client-submissions", { label, endpoint: rpc.rpcEndpoint, ...prepared.submission });
  await submitTransaction(rpc, prepared);
  await poll(label, async () => {
    const status = await transactionStatus(rpc, prepared.submission.signature);
    assert.notEqual(status.kind, "failed");
    return status.kind === "confirmed" ? status : undefined;
  });
  await captureTransaction(stack, rpc, prepared.submission.signature, label);
}

export async function captureTransaction(stack: Pick<Stack, "directory">, rpc: Connection, signature: string, label: string) {
  const transaction = await poll(`${label} transaction`, async () => await rpc.getTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 }) ?? undefined);
  assert.equal(transaction.meta?.err, null);
  const keys = transaction.transaction.message.getAccountKeys({ accountKeysFromLookups: transaction.meta?.loadedAddresses });
  const writable = Array.from({ length: keys.length }, (_, i) => i).filter(i => transaction.transaction.message.isAccountWritable(i)).map(i => keys.get(i)!);
  journal(stack.directory, "client-transactions", { label, signature, endpoint: rpc.rpcEndpoint, transaction, observedAccounts: await snapshot(rpc, writable) });
}
