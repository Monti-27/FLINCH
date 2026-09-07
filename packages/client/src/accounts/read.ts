import { SYSVAR_CLOCK_PUBKEY, PublicKey } from "@solana/web3.js";
import type { Connection, AccountInfo } from "@solana/web3.js";
import { DELEGATION_PROGRAM_ID } from "@magicblock-labs/ephemeral-rollups-sdk";
import { check } from "../errors.ts";
import { controlAddress } from "../addresses.ts";
import { createProgram, PROGRAM_ID } from "../program.ts";
import { decodeControl, decodeLedger } from "./decode.ts";
import type { BaseRoom } from "../model.ts";
import { recoveryAt } from "../model.ts";

export function clockTime(info: AccountInfo<Buffer> | null): bigint {
  check(info && info.owner.equals(new PublicKey("Sysvar1111111111111111111111111111111111111")) && info.data.length === 40, "Invalid Clock sysvar");
  const now = info.data.readBigInt64LE(32);
  check(now >= 0n, "Negative chain time");
  return now;
}

export async function readBaseRoom(base: Connection, address: PublicKey, minContextSlot?: number, programId = PROGRAM_ID): Promise<BaseRoom> {
  const response = await base.getMultipleAccountsInfoAndContext([address, controlAddress(address, programId)[0], SYSVAR_CLOCK_PUBKEY],
    { commitment: "confirmed", minContextSlot });
  const [ledgerInfo, controlInfo, clock] = response.value;
  const program = createProgram(base, programId);
  const ledger = decodeLedger(program, address, ledgerInfo);
  const now = clockTime(clock);
  const unnecessary = ledger.phase !== "started" || ledger.economics && (ledger.economics.terminalTag !== 0 || now >= recoveryAt(ledger.economics));
  const control: BaseRoom["control"] = unnecessary ? { kind: "not_required" } : !controlInfo ? { kind: "missing" } : controlInfo.owner.equals(DELEGATION_PROGRAM_ID)
    ? { kind: "delegated" } : { kind: "base", value: decodeControl(program, ledger, controlInfo) };
  return { slot: response.context.slot, now, ledger, control };
}
