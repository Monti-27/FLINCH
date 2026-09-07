import { ClientError } from "./errors.ts";

export const U64_MAX = (1n << 64n) - 1n;

export function u64(value: bigint): bigint {
  if (typeof value !== "bigint" || value < 0n || value > U64_MAX) throw new ClientError("invalid_amount", "Amount must be an unsigned 64-bit integer");
  return value;
}

export function encodeU64(value: bigint): Uint8Array {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, u64(value), true);
  return bytes;
}

export function parseUnits(value: string, decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18 || !/^(0|[1-9]\d*)(\.\d+)?$/.test(value)) throw new ClientError("invalid_amount", "Invalid decimal amount");
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > decimals) throw new ClientError("invalid_amount", "Amount has too many decimal places");
  return u64(BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, "0") || "0"));
}

export function formatUnits(value: bigint, decimals: number): string {
  u64(value);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) throw new ClientError("invalid_amount", "Invalid decimals");
  if (decimals === 0) return value.toString();
  const padded = value.toString().padStart(decimals + 1, "0");
  const fraction = padded.slice(-decimals).replace(/0+$/, "");
  return padded.slice(0, -decimals) + (fraction ? `.${fraction}` : "");
}
