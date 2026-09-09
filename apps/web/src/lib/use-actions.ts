"use client";

import { useMemo, useRef } from "react";
import { useStore } from "zustand";
import { toast } from "sonner";
import type { Connection, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { prepareTransaction } from "@flinch/client";
import type { FlinchClient, PreparedTransaction, TransactionSigner } from "@flinch/client";
import { OperationRunner } from "./operation.ts";
import type { Operation, PreparedOperation } from "./operation.ts";
import { simulateBeforeSigning } from "./preflight.ts";
import { createTransactionStore } from "../stores/transaction-store.ts";
import { operationNotification, preparationMessage } from "./notifications.ts";
import { notify, notifyActionError } from "./notify-action.ts";

export type ActionRequest = { label: string; room: PublicKey; runtime?: "base" | "er"; rpc?: Connection;
  instructions?: TransactionInstruction[]; signer: TransactionSigner; prepare?: () => Promise<PreparedOperation>;
  submit?: (prepared: PreparedTransaction) => Promise<string> };

export function useActions(client: FlinchClient, wallet: string | undefined, enabled: boolean) {
  const busyRef = useRef(false);
  const store = useMemo(createTransactionStore, [client, wallet]);
  const busy = useStore(store, state => state.busy);
  const operation = useStore(store, state => state.operation);
  const setBusy = (busy: boolean) => store.setState({ busy });
  const setOperation = (operation?: Operation) => store.setState({ operation });
  const scope = (runtime: string, room: string, label: string) => `flinch:v2:${client.config.expectedGenesis}:${wallet}:${runtime}:${room}:${label === "Recover round" ? "recovery" : "actions"}`;
  const run = async (request: ActionRequest) => {
    const reject = (message: string) => notifyActionError(new Error(message), { action: request.label });
    if (busyRef.current) throw reject("An operation is already in progress");
    if (!wallet) throw reject("Wallet is disconnected");
    if (!enabled) throw reject("Transactions are disabled");
    if (!navigator.locks) throw reject("Use a secure browser with Web Locks to prevent duplicate wallet actions");
    busyRef.current = true;
    setBusy(true);
    const runtime = request.runtime ?? "base";
    const rpc = request.rpc ?? client.base;
    const key = scope(runtime, request.room.toBase58(), request.label);
    let runner: OperationRunner | undefined;
    const notification = toast.loading(preparationMessage(request.label), { description: "Review any wallet prompt to continue." });
    try {
      runner = new OperationRunner(localStorage, key);
      const activeRunner = runner;
      return await navigator.locks.request(`flinch:${wallet}`, { ifAvailable: true }, async lock => {
        if (!lock) throw new Error("Another tab is using this wallet");
        const op = await activeRunner.run(client, { wallet, room: request.room.toBase58(), action: request.label, runtime },
          request.prepare ?? (async () => ({ rpc, prepared: await prepareTransaction(rpc, request.instructions!, request.signer, "legacy", tx => simulateBeforeSigning(rpc, tx)) })), request.submit);
        setOperation(op);
        toast.loading("Waiting for confirmation…", { id: notification, description: "Your request was sent. No need to submit it again." });
        for (let attempt = 0; attempt < 20; attempt++) {
          const current = await activeRunner.reconcile(client);
          if (current?.status !== "pending") {
            setOperation(current);
            if (current?.status === "failed") throw notifyActionError(new Error("Transaction failed"), { action: request.label, operation: current }, notification);
            notify(operationNotification(current), notification);
            return current;
          }
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        notify(operationNotification(op), notification);
        return op;
      });
    } catch (error) {
      let current: Operation | undefined;
      try { current = runner?.current(); }
      catch (storageError) { throw notifyActionError(storageError, { action: request.label }, notification); }
      setOperation(current);
      throw notifyActionError(error, { action: request.label, operation: current?.status === "pending" ? current : undefined }, notification);
    } finally { busyRef.current = false; setBusy(false); }
  };
  const check = async (room: string) => {
    try {
      const records = await Promise.all([scope("base", room, ""), scope("er", room, ""), scope("base", room, "Recover round")]
        .map(key => new OperationRunner(localStorage, key).reconcile(client)));
      const op = records.find(value => value?.status === "pending") ?? records.filter(Boolean).at(-1);
      setOperation(op);
      notify(op ? operationNotification(op) : { tone: "info", title: "No saved transaction",
        description: "There is no transaction to check for this wallet and room." });
    } catch (error) { notifyActionError(error, { action: "Check transaction" }); }
  };
  return { busy, operation, run, check };
}
