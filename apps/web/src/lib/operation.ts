import { PublicKey } from "@solana/web3.js";
import type { Connection } from "@solana/web3.js";
import { isTransactionSignature, SellNotSubmittedError, submitTransaction, verifyNetwork } from "@flinch/client";
import type { FlinchClient, PreparedTransaction } from "@flinch/client";

export type Operation = Readonly<{ version: 1; wallet: string; genesis: string; room: string; action: string;
  signature: string; runtime: "base" | "er"; endpoint: string; status: "pending" | "confirmed" | "failed" | "not_sent" }>;
export type PublicStorage = Pick<Storage, "getItem" | "setItem">;
export type PreparedOperation = Readonly<{ prepared: PreparedTransaction; rpc: Connection }>;

export class OperationRunner {
  private busy = false;
  constructor(private storage: PublicStorage, private scope: string) {}

  current(): Operation | undefined {
    const raw = this.storage.getItem(this.scope);
    if (!raw) return;
    if (raw.length > 4096) throw new Error("Invalid local transaction record");
    const op = JSON.parse(raw) as Operation;
    const keys = ["version", "wallet", "genesis", "room", "action", "signature", "runtime", "endpoint", "status"];
    if (Object.keys(op).length !== keys.length || Object.keys(op).some(key => !keys.includes(key))
      || op.version !== 1 || !isTransactionSignature(op.signature) || !["base", "er"].includes(op.runtime)
      || !["pending", "confirmed", "failed", "not_sent"].includes(op.status) || typeof op.action !== "string" || op.action.length > 80) throw new Error("Invalid local transaction record");
    new PublicKey(op.wallet);
    new PublicKey(op.room);
    new PublicKey(op.genesis);
    return op;
  }

  async reconcile(client: FlinchClient): Promise<Operation | undefined> {
    const op = this.current();
    if (!op || op.status !== "pending") return op;
    if (op.genesis !== client.config.expectedGenesis) throw new Error("Pending transaction belongs to another network");
    const status = await client.status(op.runtime, op.endpoint, op.signature);
    if (status.kind === "pending") return op;
    const updated: Operation = { ...op, status: status.kind };
    this.storage.setItem(this.scope, JSON.stringify(updated));
    return updated;
  }

  async run(client: FlinchClient, identity: Pick<Operation, "wallet" | "room" | "action" | "runtime">,
    prepare: () => Promise<PreparedOperation>, submit?: (prepared: PreparedTransaction) => Promise<string>) {
    if (this.busy) throw new Error("A wallet operation is already in progress");
    this.busy = true;
    try {
      await verifyNetwork(client.base, client.config.network, client.config.expectedGenesis);
      if ((await this.reconcile(client))?.status === "pending") throw new Error("Previous transaction is still unconfirmed. Check its status before signing again.");
      const { prepared, rpc } = await prepare();
      const op: Operation = { version: 1, ...identity, genesis: client.config.expectedGenesis, signature: prepared.submission.signature,
        runtime: identity.runtime, endpoint: rpc.rpcEndpoint, status: "pending" };
      this.storage.setItem(this.scope, JSON.stringify(op));
      try { await (submit ? submit(prepared) : submitTransaction(rpc, prepared)); }
      catch (error) {
        if (error instanceof SellNotSubmittedError) this.storage.setItem(this.scope, JSON.stringify({ ...op, status: "not_sent" }));
        throw error;
      }
      return op;
    } finally { this.busy = false; }
  }
}
