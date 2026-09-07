import type { Submission } from "@flinch/client";
import type { Action } from "./decision.ts";
import { appendOperation } from "./operation.ts";

export type Operation = Readonly<Submission & {
  version: 1; room: string; action: Action; revision: string | null;
  runtime: "base" | "er"; endpoint: string; genesis: string;
  status: "pending" | "confirmed" | "failed" | "superseded";
  observedSlot: number; confirmationSlot?: number; returnSignature?: string;
}>;

export interface OperationStore {
  get(room: string): Promise<Operation | null>;
  put(operation: Operation): Promise<void>;
}

export class MemoryOperationStore implements OperationStore {
  private readonly records = new Map<string, readonly Operation[]>();
  async get(room: string) { return this.records.get(room)?.at(-1) ?? null; }
  async history(room: string) { return [...this.records.get(room) ?? []]; }
  async put(operation: Operation) { this.records.set(operation.room, appendOperation(this.records.get(operation.room) ?? [], operation)); }
}
