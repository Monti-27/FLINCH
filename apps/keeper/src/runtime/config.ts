import { isAbsolute, normalize } from "node:path";
import { PublicKey } from "@solana/web3.js";
import { DEVNET_GENESIS, endpoint } from "@flinch/client";
import type { Network } from "@flinch/client";
import { KeeperError } from "./errors.ts";
import { readBoundedFile } from "./files.ts";

export type KeeperConfig = Readonly<{
  network: Network; baseUrl: string; expectedGenesis: string; rooms: readonly PublicKey[];
  journalDirectory: string; keypairFile?: string; payer?: PublicKey; localErUrl?: string;
  concurrency: number; messageVersion: "v0" | "legacy";
  discovery?: Readonly<{ pool: PublicKey; validator: PublicKey }>;
}>;

const fields = new Set(["version", "network", "baseUrl", "expectedGenesis", "rooms", "journalDirectory", "keypairFile", "payer", "localErUrl", "concurrency", "messageVersion", "discovery"]);
const invalid = () => new KeeperError("invalid_config");
const path = (value: unknown) => {
  if (typeof value !== "string" || !isAbsolute(value) || value.includes("\0") || value === "/") throw invalid();
  const normalized = normalize(value);
  if (normalized === "/") throw invalid();
  return normalized;
};
const key = (value: unknown) => {
  if (typeof value !== "string") throw invalid();
  const result = new PublicKey(value);
  if (result.toBase58() !== value || result.equals(PublicKey.default)) throw invalid();
  return result;
};

export function parseConfig(value: unknown): KeeperConfig {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
    const v = value as Record<string, unknown>;
    if (Object.keys(v).some(name => !fields.has(name)) || v.version !== 1
      || (v.network !== "devnet" && v.network !== "localnet") || typeof v.baseUrl !== "string"
      || !Array.isArray(v.rooms) || v.rooms.length > 128) throw invalid();
    let discovery: KeeperConfig["discovery"];
    if (v.discovery !== undefined) {
      if (!v.discovery || typeof v.discovery !== "object" || Array.isArray(v.discovery)) throw invalid();
      const d = v.discovery as Record<string, unknown>;
      if (Object.keys(d).some(name => name !== "pool" && name !== "validator")) throw invalid();
      discovery = Object.freeze({ pool: key(d.pool), validator: key(d.validator) });
    }
    if (v.rooms.length === 0 && !discovery) throw invalid();
    const expectedGenesis = key(v.expectedGenesis).toBase58();
    if (v.network === "devnet" && expectedGenesis !== DEVNET_GENESIS) throw invalid();
    const rooms = v.rooms.map(key);
    if (new Set(rooms.map(room => room.toBase58())).size !== rooms.length) throw invalid();
    const concurrency = v.concurrency ?? 4;
    if (typeof concurrency !== "number" || !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) throw invalid();
    const messageVersion = v.messageVersion ?? (v.network === "localnet" ? "legacy" : "v0");
    if (messageVersion !== "legacy" && messageVersion !== "v0") throw invalid();
    if (v.network === "localnet" ? typeof v.localErUrl !== "string" : v.localErUrl !== undefined) throw invalid();
    if ((v.keypairFile === undefined) !== (v.payer === undefined)) throw invalid();
    return Object.freeze({ network: v.network, expectedGenesis, rooms: Object.freeze(rooms), concurrency, messageVersion, discovery,
      baseUrl: endpoint(v.baseUrl, v.network), journalDirectory: path(v.journalDirectory),
      localErUrl: v.localErUrl === undefined ? undefined : endpoint(v.localErUrl as string, "localnet"),
      keypairFile: v.keypairFile === undefined ? undefined : path(v.keypairFile), payer: v.payer === undefined ? undefined : key(v.payer) });
  } catch { throw invalid(); }
}

export async function readConfig(path: string) {
  const bytes = await readBoundedFile(path, 65_536, true);
  try { return parseConfig(JSON.parse(bytes.toString("utf8"))); } catch { throw invalid(); }
}
