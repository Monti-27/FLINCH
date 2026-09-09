import { PublicKey } from "@solana/web3.js";

export function roomAddress(value: string) {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) throw new Error("Invalid room address");
  const key = new PublicKey(value);
  if (key.equals(PublicKey.default) || key.toBase58() !== value) throw new Error("Invalid room address");
  return value;
}

export function roomLink(href: string, address: string) {
  const source = new URL(href);
  if (!["http:", "https:"].includes(source.protocol)) throw new Error("Invalid app origin");
  const link = new URL("/play", source.origin);
  link.searchParams.set("room", roomAddress(address));
  return link.href;
}

export function readRoomLink(value: string, origin: string) {
  const input = value.trim();
  if (input.length > 2048) throw new Error("Invalid room link");
  if (!input.includes("://")) return roomAddress(input);
  const link = new URL(input);
  if (link.origin !== new URL(origin).origin || !["/", "/play"].includes(link.pathname) || link.username || link.password
    || !["http:", "https:"].includes(link.protocol) || link.searchParams.getAll("room").length !== 1) throw new Error("Invalid room link");
  return roomAddress(link.searchParams.get("room") ?? "");
}

export function legacyRoomDestination(value: string | string[] | undefined) {
  if (typeof value !== "string") return undefined;
  try { return `/play?room=${roomAddress(value)}`; } catch { return undefined; }
}
