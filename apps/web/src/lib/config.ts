import { PublicKey } from "@solana/web3.js";
import { FlinchClient, DEVNET_GENESIS, endpoint } from "@flinch/client";
import type { ClientConfig } from "@flinch/client";
import { localPlacement } from "./local-placement.ts";

export type WebConfig = ClientConfig & { transactions: boolean; pool?: PublicKey; validator?: PublicKey; localEr?: string };

export function webConfig(): WebConfig {
  const network = process.env.NEXT_PUBLIC_FLINCH_NETWORK ?? "devnet";
  if (network !== "localnet" && network !== "devnet") throw new Error("FLINCH supports localnet and devnet only");
  const baseUrl = endpoint(process.env.NEXT_PUBLIC_FLINCH_BASE_RPC ?? "https://rpc.magicblock.app/devnet", network);
  const expectedGenesis = process.env.NEXT_PUBLIC_FLINCH_GENESIS ?? (network === "devnet" ? DEVNET_GENESIS : "");
  if (!expectedGenesis) throw new Error("Localnet requires its explicit genesis hash");
  const localEr = process.env.NEXT_PUBLIC_FLINCH_LOCAL_ER;
  if (network === "localnet" && !localEr) throw new Error("Localnet requires an explicit local ER resolver");
  return { network, baseUrl, expectedGenesis, localEr, transactions: process.env.NEXT_PUBLIC_FLINCH_ENABLE_TRANSACTIONS === "true",
    pool: process.env.NEXT_PUBLIC_FLINCH_POOL ? new PublicKey(process.env.NEXT_PUBLIC_FLINCH_POOL) : undefined,
    validator: process.env.NEXT_PUBLIC_FLINCH_VALIDATOR ? new PublicKey(process.env.NEXT_PUBLIC_FLINCH_VALIDATOR) : undefined };
}

export function webClient(config: WebConfig) {
  return new FlinchClient(config, config.network === "localnet" ? localPlacement(config.baseUrl, config.localEr!) : undefined);
}
