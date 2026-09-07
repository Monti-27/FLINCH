import { SYSVAR_CLOCK_PUBKEY } from "@solana/web3.js";
import type { Connection, PublicKey } from "@solana/web3.js";
import { NATIVE_MINT, unpackAccount, unpackMint } from "@solana/spl-token";
import { RAYDIUM_ID, USDC_MINT } from "../program.ts";
import { clockTime } from "../accounts/read.ts";
import { check } from "../errors.ts";
import { u64 } from "../amounts.ts";
import { decodePool, decodePoolAccount, poolKey, poolUnits } from "../accounts/raydium.ts";
import type { CurveState } from "./curve.ts";

export type PoolSnapshot = Readonly<CurveState & { pool: PublicKey; slot: number; chainTime: bigint; receivedAtMs: number }>;

export async function readQuotePool(base: Connection, pool: PublicKey, minContextSlot?: number): Promise<PoolSnapshot> {
  const discovered = decodePool(await base.getAccountInfo(pool, "confirmed"));
  const response = await base.getMultipleAccountsInfoAndContext([pool, discovered.ammConfig, discovered.poolWsolVault,
    discovered.poolUsdcVault, discovered.observation, NATIVE_MINT, USDC_MINT, SYSVAR_CLOCK_PUBKEY, RAYDIUM_ID],
  { commitment: "confirmed", minContextSlot });
  const [poolInfo, configInfo, inputInfo, outputInfo, observationInfo, wsolInfo, usdcInfo, clockInfo, programInfo] = response.value;
  check(Number.isSafeInteger(response.context.slot) && response.context.slot >= (minContextSlot ?? 0), "Pool context is stale");
  const state = decodePool(poolInfo);
  for (const field of ["ammConfig", "poolWsolVault", "poolUsdcVault", "observation"] as const) check(state[field].equals(discovered[field]), "Pool changed while resolving accounts");
  check(programInfo?.executable, "Raydium is not executable");
  check(poolKey(decodePoolAccount("ObservationState", observationInfo).pool_id).equals(pool), "Observation belongs to another pool");
  const config = decodePoolAccount("AmmConfig", configInfo);
  const wsol = unpackMint(NATIVE_MINT, wsolInfo);
  const usdc = unpackMint(USDC_MINT, usdcInfo);
  check(wsol.isInitialized && wsol.decimals === 9 && usdc.isInitialized && usdc.decimals === 6, "Invalid mint state");
  const input = unpackAccount(state.poolWsolVault, inputInfo);
  const output = unpackAccount(state.poolUsdcVault, outputInfo);
  check(input.isInitialized && output.isInitialized && !input.isFrozen && !output.isFrozen
    && input.owner.equals(state.authority) && output.owner.equals(state.authority)
    && input.mint.equals(NATIVE_MINT) && output.mint.equals(USDC_MINT), "Invalid pool vaults");
  const now = clockTime(clockInfo);
  check(state.enabled && now >= state.openTime, "Pool is not open for swaps");
  return Object.freeze({ pool, slot: response.context.slot, chainTime: now, receivedAtMs: Date.now(),
    inputReserve: u64(input.amount - state.inputFees), outputReserve: u64(output.amount - state.outputFees),
    tradeFeeRate: poolUnits(config.trade_fee_rate), protocolFeeRate: poolUnits(config.protocol_fee_rate),
    fundFeeRate: poolUnits(config.fund_fee_rate), creatorFeeRate: state.raw.enable_creator_fee === true ? poolUnits(config.creator_fee_rate) : 0n,
    creatorFeeOnInput: state.creatorFeeOnInput });
}
