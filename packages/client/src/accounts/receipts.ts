import type { Connection, PublicKey } from "@solana/web3.js";
import type { BaseRoom, Seats } from "../model.ts";
import { createProgram, PROGRAM_ID } from "../program.ts";
import type { WireAccounts } from "../program.ts";
import { receiptAddress } from "../addresses.ts";
import { u64 } from "../amounts.ts";
import { check } from "../errors.ts";

export type Receipt = Readonly<{ address: PublicKey; revision: bigint; sellers: number; cohort: number; expired: boolean;
  executedAt: bigint; input: bigint; output: bigint; allocations: Seats<bigint> }>;

export async function readReceipts(base: Connection, room: BaseRoom, programId = PROGRAM_ID): Promise<readonly Receipt[]> {
  const count = room.ledger.economics?.revision ?? 0n;
  check(count >= 0n && count <= 12n, "Receipt count exceeds room attempt bound");
  if (count === 0n) return [];
  const keys = Array.from({ length: Number(count) }, (_, index) => receiptAddress(room.ledger.address, BigInt(index), programId));
  const response = await base.getMultipleAccountsInfoAndContext(keys, { commitment: "confirmed", minContextSlot: room.slot });
  check(response.context.slot >= room.slot && response.value.length === keys.length, "Receipt snapshot is incomplete or stale");
  const coder = createProgram(base, programId).coder.accounts;
  const receipts = response.value.map((info, index): Receipt => {
    check(info && !info.executable && info.owner.equals(programId), "Invalid receipt owner");
    const raw = coder.decode<WireAccounts["batchReceipt"]>("batchReceipt", info.data);
    check(raw.version === 2 && raw.ledger.equals(room.ledger.address) && BigInt(raw.revision.toString()) === BigInt(index), "Receipt belongs to another room or revision");
    check(raw.sellers > 0 && raw.sellers <= 15 && raw.cohortIndex < 45, "Invalid receipt cohort");
    const input = u64(BigInt(raw.input.toString()));
    const output = u64(BigInt(raw.output.toString()));
    const allocations = raw.allocations.map(value => u64(BigInt(value.toString())));
    check(allocations.length === 4 && allocations.reduce((a, b) => a + b, 0n) === output, "Receipt allocation does not conserve output");
    check(raw.expired ? input === 0n && output === 0n : input > 0n && output > 0n, "Receipt outcome is inconsistent");
    check(allocations.every((value, seat) => !!(raw.sellers & (1 << seat)) || value === 0n), "Receipt pays a nonseller");
    return { address: keys[index], revision: BigInt(index), sellers: raw.sellers, cohort: raw.cohortIndex, expired: raw.expired,
      executedAt: BigInt(raw.executedAt.toString()), input, output, allocations: allocations as unknown as Seats<bigint> };
  });
  check(receipts.reduce((sum, receipt) => sum + receipt.input, 0n) === room.ledger.economics!.swappedWsol
    && receipts.reduce((sum, receipt) => sum + receipt.output, 0n) === room.ledger.economics!.receivedUsdc, "Receipts differ from Ledger settlement totals");
  return receipts;
}
