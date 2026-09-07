import type { Connection, PublicKey } from "@solana/web3.js";
import { NATIVE_MINT, unpackAccount } from "@solana/spl-token";
import { USDC_MINT } from "../program.ts";
import { check } from "../errors.ts";
import { decodePool } from "./raydium.ts";

export type PoolAccounts = Readonly<{
  pool: PublicKey; ammConfig: PublicKey; observation: PublicKey; authority: PublicKey;
  poolWsolVault: PublicKey; poolUsdcVault: PublicKey;
}>;

export async function readPoolAccounts(base: Connection, pool: PublicKey): Promise<PoolAccounts> {
  const { poolWsolVault, poolUsdcVault, authority, ammConfig, observation } = decodePool(await base.getAccountInfo(pool, "confirmed"));
  const [wsolInfo, usdcInfo] = await base.getMultipleAccountsInfo([poolWsolVault, poolUsdcVault], "confirmed");
  check(wsolInfo && usdcInfo, "Pool reserves unavailable");
  const wsol = unpackAccount(poolWsolVault, wsolInfo);
  const usdc = unpackAccount(poolUsdcVault, usdcInfo);
  check(wsol.mint.equals(NATIVE_MINT) && usdc.mint.equals(USDC_MINT) && wsol.owner.equals(authority) && usdc.owner.equals(authority), "Invalid pool reserves");
  check(wsol.isInitialized && usdc.isInitialized && !wsol.isFrozen && !usdc.isFrozen, "Pool reserve is unavailable");
  return { pool, poolWsolVault, poolUsdcVault, authority, ammConfig, observation };
}
