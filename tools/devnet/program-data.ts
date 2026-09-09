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
  if (!PublicKey.findProgramAddressSync([address.toBuffer()], LOADER)[0].equals(programData)) throw new Error("Program data address differs");
  const data = await base.getAccountInfo(programData, "confirmed");
  if (!data || data.executable || !data.owner.equals(LOADER) || data.data.length < 45 || data.data.readUInt32LE(0) !== 3) throw new Error("Invalid program data");
  const option = data.data[12];
  if (option !== 0 && option !== 1) throw new Error("Invalid upgrade authority");
  return { program: address.toBase58(), programData: programData.toBase58(), slot: data.data.readBigUInt64LE(4).toString(),
    authority: option === 1 ? new PublicKey(data.data.subarray(13, 45)).toBase58() : null,
    bytes: data.data.subarray(45), hash: hash(data.data.subarray(45)) };
}

export async function deploymentBuffer(base: Connection, address: PublicKey, authority: PublicKey, size: number) {
  const info = await base.getAccountInfo(address, "confirmed");
  if (!info) return { address: address.toBase58(), funded: 0n };
  if (info.executable || !info.owner.equals(LOADER) || info.data.length !== size + 37 || info.data.readUInt32LE(0) !== 1
    || info.data[4] !== 1 || !new PublicKey(info.data.subarray(5, 37)).equals(authority)
    || !Number.isSafeInteger(info.lamports) || info.lamports < 0) throw new Error("Existing deployment buffer differs; reconcile before retrying");
  return { address: address.toBase58(), funded: BigInt(info.lamports) };
}

export function matchesBinary(actual: Uint8Array, expected: Uint8Array) {
  return actual.length >= expected.length && Buffer.from(actual.subarray(0, expected.length)).equals(Buffer.from(expected))
    && actual.subarray(expected.length).every(byte => byte === 0);
}
