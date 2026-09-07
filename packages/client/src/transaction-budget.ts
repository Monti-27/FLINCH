import { ComputeBudgetInstruction, ComputeBudgetProgram } from "@solana/web3.js";
import type { TransactionInstruction } from "@solana/web3.js";
import { check } from "./errors.ts";

const MAX_COMPUTE_UNITS = 1_400_000;
const COMPUTE_UNITS_PER_INSTRUCTION = 200_000;

export function withExplicitBudget(instructions: TransactionInstruction[]): TransactionInstruction[] {
  const seen = new Set<string>();
  let applicationInstructions = 0;
  for (const instruction of instructions) {
    if (!instruction.programId.equals(ComputeBudgetProgram.programId)) { applicationInstructions++; continue; }
    const type = ComputeBudgetInstruction.decodeInstructionType(instruction);
    check(!seen.has(type), "Duplicate compute budget instruction");
    check(type !== "RequestUnits", "Deprecated compute budget instruction");
    seen.add(type);
    if (type === "SetComputeUnitLimit") {
      const { units } = ComputeBudgetInstruction.decodeSetComputeUnitLimit(instruction);
      check(units > 0 && units <= MAX_COMPUTE_UNITS, "Invalid compute unit limit");
    }
    if (type === "SetComputeUnitPrice") ComputeBudgetInstruction.decodeSetComputeUnitPrice(instruction);
  }
  check(applicationInstructions > 0, "Transaction has no application instructions");
  const prefix: TransactionInstruction[] = [];
  if (!seen.has("SetComputeUnitLimit")) prefix.push(ComputeBudgetProgram.setComputeUnitLimit({
    units: Math.min(MAX_COMPUTE_UNITS, applicationInstructions * COMPUTE_UNITS_PER_INSTRUCTION),
  }));
  if (!seen.has("SetComputeUnitPrice")) prefix.push(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 0n }));
  return [...prefix, ...instructions];
}
