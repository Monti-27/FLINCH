import { Connection } from "@solana/web3.js";
import { ClientError } from "./errors.ts";

export type Network = "devnet" | "localnet";
export const DEVNET_GENESIS = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";

export function endpoint(value: string, network: Network, routed = false): string {
  if (network !== "localnet" && network !== "devnet") throw new ClientError("wrong_network", "Unsupported network");
  const url = new URL(value);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  const host = url.hostname === "magicblock.app" || url.hostname.endsWith(".magicblock.app");
  if (url.username || url.password || url.search || url.hash
    || (network === "localnet" ? !local || !["http:", "https:"].includes(url.protocol) : local || url.protocol !== "https:" || (routed && !host))) {
    throw new ClientError("unsafe_endpoint", "Endpoint does not satisfy the configured network policy");
  }
  return url.toString();
}

export function connection(value: string, network: Network): Connection {
  return new Connection(endpoint(value, network), { commitment: "confirmed", disableRetryOnRateLimit: true,
    fetch: (input, init) => fetch(input, { ...init, redirect: "error", signal: AbortSignal.timeout(5000) }) });
}

export async function verifyNetwork(base: Pick<Connection, "getGenesisHash">, network: Network, expectedGenesis: string) {
  if (!expectedGenesis || (network === "devnet" && expectedGenesis !== DEVNET_GENESIS)
    || await base.getGenesisHash() !== expectedGenesis) throw new ClientError("wrong_network", "Base genesis does not match the selected network");
}
