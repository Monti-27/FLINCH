import type { Connection, PublicKey, VersionedTransactionResponse } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { PROGRAM_ID, createProgram } from "./program.ts";
import { check } from "./errors.ts";

export type ReturnProof = Readonly<{ signature: string; slot: number }>;

export function returnedControl(transaction: VersionedTransactionResponse, control: PublicKey, connection: Connection, programId = PROGRAM_ID): boolean {
  if (!transaction.meta || transaction.meta.err) return false;
  const message = transaction.transaction.message;
  const keys = message.getAccountKeys({ accountKeysFromLookups: transaction.meta.loadedAddresses });
  const coder = new anchor.BorshInstructionCoder(createProgram(connection, programId).idl);
  for (const inner of transaction.meta.innerInstructions ?? []) {
    for (const ix of inner.instructions) {
      if (!keys.get(ix.programIdIndex)?.equals(programId) || !keys.get(ix.accounts[0])?.equals(control) || !message.isAccountWritable(ix.accounts[0])) continue;
      if (coder.decode(ix.data, "base58")?.name === "processUndelegation") return true;
    }
  }
  return false;
}

export async function findReturnProof(base: Connection, control: PublicKey, snapshotSlot: number, programId = PROGRAM_ID): Promise<ReturnProof | undefined> {
  check(Number.isSafeInteger(snapshotSlot) && snapshotSlot >= 0, "Invalid snapshot slot");
  const signatures = await base.getSignaturesForAddress(control, { limit: 16 }, "confirmed");
  for (const item of signatures) {
    if (item.err || item.slot > snapshotSlot) continue;
    const transaction = await base.getTransaction(item.signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
    if (transaction && transaction.slot === item.slot && transaction.slot <= snapshotSlot && returnedControl(transaction, control, base, programId)) return { signature: item.signature, slot: transaction.slot };
  }
}
