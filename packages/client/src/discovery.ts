import type { Connection, PublicKey } from "@solana/web3.js";
import { createProgram, DEVNET_PROGRAM_ID } from "./program.ts";
import { decodeLedger } from "./accounts/decode.ts";
import { check } from "./errors.ts";

export type RoomDiscovery = Readonly<{ pool: PublicKey; validator: PublicKey }>;

export async function discoverRooms(base: Connection, scope: RoomDiscovery, programId = DEVNET_PROGRAM_ID) {
  const program = createProgram(base, programId);
  const discriminator = program.coder.accounts.memcmp("roomLedger");
  const accounts = await base.getProgramAccounts(programId, { commitment: "confirmed", filters: [
    { memcmp: discriminator }, { memcmp: { offset: 50, bytes: scope.validator.toBase58() } },
    { memcmp: { offset: 82, bytes: scope.pool.toBase58() } },
  ] });
  check(accounts.length <= 4096, "Discovery response exceeds the demo room limit");
  const rooms = accounts.map(({ pubkey, account }) => decodeLedger(program, pubkey, account));
  check(rooms.every(room => room.pool.equals(scope.pool) && room.validator.equals(scope.validator)), "Discovery scope differs");
  return rooms.filter(room => room.phase !== "cancelled" && (!room.economics || room.economics.terminalTag === 0))
    .sort((a, b) => a.fundingDeadline < b.fundingDeadline ? -1 : a.fundingDeadline > b.fundingDeadline ? 1 : a.address.toBase58().localeCompare(b.address.toBase58()))
    .map(room => room.address);
}
