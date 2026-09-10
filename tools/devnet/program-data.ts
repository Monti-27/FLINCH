import { createHash } from "node:crypto";
import { PublicKey } from "@solana/web3.js";
import type { Connection } from "@solana/web3.js";

const LOADER = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");
export const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

export async function deployedProgram(base: Connection, address: PublicKey) {
  const info = await base.getAccountInfo(address, "confirmed");
  if (!info) return null;
  if (!info.executable || !info.owner.equals(LOADER) || info.data.length !== 36 || info.data.readUInt32LE(0) !== 2) throw new Error("Unexpected program loader");
  const programData = new PublicKey(info.data.subarray(4, 36));
  const data = await base.getAccountInfo(programData, "confirmed");
  if (!data || data.executable || !data.owner.equals(LOADER) || data.data.length < 45 || data.data.readUInt32LE(0) !== 3) throw new Error("Invalid program data");
  const option = data.data[12];
  if (option !== 0 && option !== 1) throw new Error("Invalid upgrade authority");
  return { program: address.toBase58(), programData: programData.toBase58(), slot: data.data.readBigUInt64LE(4).toString(),
    authority: option === 1 ? new PublicKey(data.data.subarray(13, 45)).toBase58() : null,
    bytes: data.data.subarray(45), hash: hash(data.data.subarray(45)) };
}

export function matchesBinary(actual: Uint8Array, expected: Uint8Array) {
  return actual.length >= expected.length && Buffer.from(actual.subarray(0, expected.length)).equals(Buffer.from(expected))
    && actual.subarray(expected.length).every(byte => byte === 0);
}
