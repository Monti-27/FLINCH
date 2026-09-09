import { createStore } from "zustand/vanilla";
import type { Operation } from "../lib/operation.ts";

export type TransactionState = { busy: boolean; operation?: Operation };

export function createTransactionStore() {
  return createStore<TransactionState>()(() => ({ busy: false }));
}
