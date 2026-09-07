import { prepareTransaction, submitTransaction } from "@flinch/client";
import type { FlinchClient, TransactionSigner, BaseRoom, PreparedTransaction } from "@flinch/client";
import type { Connection, PublicKey } from "@solana/web3.js";
import { decide } from "./decision.ts";
import type { Action, Decision } from "./decision.ts";
import { deadlineSupersedes, superseded } from "./reconcile.ts";
import type { OperationStore, Operation } from "./store.ts";

export type WorkerEvent = Readonly<{ room: string; kind: string; action?: Action; signature?: string; reason?: string }>;
export type WorkerOptions = { messageVersion?: "v0" | "legacy"; onEvent?: (event: WorkerEvent) => void };
export type ClientPort = Pick<FlinchClient, "base" | "config" | "readRoom" | "resolve" | "execute" | "returnProof" | "instructions" | "status">;

export class RoomWorker {
  private readonly active = new Set<string>();
  private readonly client: ClientPort;
  private readonly signer: TransactionSigner;
  private readonly store: OperationStore;
  private readonly options: WorkerOptions;

  constructor(client: ClientPort, signer: TransactionSigner, store: OperationStore, options: WorkerOptions = {}) {
    this.client = client; this.signer = signer; this.store = store; this.options = options;
  }

  async tick(address: PublicKey, signal?: AbortSignal): Promise<WorkerEvent> {
    const room = address.toBase58();
    if (this.active.has(room)) return { room, kind: "busy" };
    this.active.add(room);
    try {
      signal?.throwIfAborted();
      const pending = await this.store.get(room);
      if (pending && pending.genesis !== this.client.config.expectedGenesis) throw new Error("Journal belongs to another chain");
      const floor = pending ? Math.max(pending.observedSlot, pending.runtime === "base" ? pending.confirmationSlot ?? 0 : 0) : undefined;
      const snapshot = await this.client.readRoom(address, floor);
      let decision = decide(snapshot);
      if (pending?.status === "pending") {
        if (superseded(pending, snapshot) || deadlineSupersedes(pending, decision)) {
          await this.store.put({ ...pending, status: "superseded" });
          this.emit({ room, kind: "superseded", action: pending.action, signature: pending.signature });
        } else {
          const status = await this.client.status(pending.runtime, pending.endpoint, pending.signature);
          if (status.kind !== "pending") await this.store.put({ ...pending, status: status.kind, confirmationSlot: status.slot });
          return this.emit({ room, kind: status.kind, action: pending.action, signature: pending.signature });
        }
      }
      let rpc = this.client.base;
      if (decision.kind === "resolve") {
        const ephemeral = await this.client.resolve(snapshot, signal);
        decision = decide(snapshot, ephemeral);
        rpc = ephemeral.connection;
      }
      if (decision.kind !== "act") return this.emit({ room, kind: decision.kind, reason: decision.kind === "wait" ? decision.reason : undefined });
      return await this.act(snapshot, decision, rpc, signal);
    } finally { this.active.delete(room); }
  }

  private async act(snapshot: BaseRoom, decision: Extract<Decision, { kind: "act" }>, rpc: Connection, signal?: AbortSignal): Promise<WorkerEvent> {
    const ledger = snapshot.ledger;
    const room = ledger.address.toBase58();
    const payer = this.signer.publicKey;
    const { action, revision } = decision;
    let returnSignature: string | undefined;
    if (action === "execute" || action === "expire") {
      const proof = await this.client.returnProof(snapshot);
      if (!proof) return this.emit({ room, kind: "wait", reason: "base return transaction not yet verified" });
      returnSignature = proof.signature;
    }
    const build = this.client.instructions;
    const instruction = await (action === "execute" ? this.client.execute(ledger.address, revision!, payer, ledger.pool)
      : action === "expire" ? build.expire(ledger.address, revision!, payer)
      : action === "recover" ? build.recover(ledger.address)
      : build[action](ledger.address, payer));
    signal?.throwIfAborted();
    const prepared = await prepareTransaction(rpc, [instruction], this.signer, this.options.messageVersion);
    signal?.throwIfAborted();
    const operation: Operation = { version: 1, room, action, revision: revision?.toString() ?? null,
      ...prepared.submission, runtime: action === "freeze" ? "er" : "base", endpoint: rpc.rpcEndpoint,
      genesis: this.client.config.expectedGenesis, status: "pending", observedSlot: snapshot.slot, returnSignature };
    await this.store.put(operation);
    return this.submit(rpc, prepared, operation, signal);
  }

  private async submit(rpc: Connection, prepared: PreparedTransaction, operation: Operation, signal?: AbortSignal) {
    signal?.throwIfAborted();
    await submitTransaction(rpc, prepared);
    return this.emit({ room: operation.room, kind: "submitted", action: operation.action, signature: operation.signature });
  }

  private emit(event: WorkerEvent): WorkerEvent { this.options.onEvent?.(event); return event; }
}
