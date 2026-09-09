import { DEVNET_GENESIS } from "@flinch/client";
import { parseConfig } from "./runtime/config.ts";

export function hostedConfig(env: NodeJS.ProcessEnv) {
  if (!env.DATABASE_URL || ![undefined, "false", "true"].includes(env.FLINCH_KEEPER_EXECUTE)) throw new Error("Invalid hosted configuration");
  const port = Number(env.PORT ?? "8080");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid hosted port");
  const execute = env.FLINCH_KEEPER_EXECUTE === "true";
  const config = parseConfig({ version: 1, network: "devnet",
    baseUrl: env.FLINCH_BASE_RPC ?? "https://rpc.magicblock.app/devnet", expectedGenesis: DEVNET_GENESIS,
    rooms: [], discovery: { pool: env.FLINCH_POOL, validator: env.FLINCH_VALIDATOR },
    journalDirectory: "/tmp/flinch-journal", concurrency: 4, messageVersion: "v0",
    ...(execute ? { keypairFile: env.FLINCH_KEEPER_KEYPAIR_FILE, payer: env.FLINCH_KEEPER_PAYER } : {}) });
  if (execute && (!config.keypairFile || !config.payer)) throw new Error("Keeper signer is required");
  return { config, execute, port, databaseUrl: env.DATABASE_URL };
}
