import { PublicKey } from "@solana/web3.js";

export type LocalCommand = { kind: "help" | "status" | "quit" } | { kind: "fund" | "watch" | "pause"; address: PublicKey };

export function parseCommand(line: string): LocalCommand {
  if (line.length > 256) throw new Error("Command is too long");
  const [kind, address, ...extra] = line.trim().split(/\s+/);
  if (["help", "status", "quit"].includes(kind) && address === undefined) return { kind: kind as "help" | "status" | "quit" };
  if (!["fund", "watch", "pause"].includes(kind) || !address || extra.length) throw new Error("Use help, status, fund ADDRESS, watch ROOM, pause ROOM or quit");
  let key: PublicKey;
  try { key = new PublicKey(address); } catch { throw new Error("Use a Solana public address, never a private key"); }
  if (key.toBase58() !== address || key.equals(PublicKey.default) || (kind === "fund" && !PublicKey.isOnCurve(key))) {
    throw new Error("Invalid wallet or room address");
  }
  return { kind: kind as "fund" | "watch" | "pause", address: key };
}
