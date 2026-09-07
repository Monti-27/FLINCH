import * as anchor from "@coral-xyz/anchor";
import { Buffer } from "buffer";
import { PublicKey } from "@solana/web3.js";
import type { AccountInfo } from "@solana/web3.js";
import { NATIVE_MINT, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import idl from "../../generated/raydium.json" with { type: "json" };
import { USDC_MINT, RAYDIUM_ID } from "../program.ts";
import { check } from "../errors.ts";
import { u64 } from "../amounts.ts";
import { isRecord } from "../routing/rpc.ts";

export const poolCoder = new anchor.BorshAccountsCoder(idl as anchor.Idl);
export const poolKey = (value: unknown) => { check(value instanceof PublicKey, "Invalid pool address"); return value; };
export const poolUnits = (value: unknown) => {
  check(anchor.BN.isBN(value), "Invalid pool amount");
  return u64(BigInt(value.toString()));
};
export function decodePoolAccount(name: string, info: AccountInfo<Buffer> | null) {
  check(info && info.owner.equals(RAYDIUM_ID) && !info.executable && info.data.length === poolCoder.size(name), "Invalid pool account owner or layout");
  const raw: unknown = poolCoder.decode(name, info.data);
  check(isRecord(raw), "Invalid pool data");
  return raw;
}

export function decodePool(info: AccountInfo<Buffer> | null) {
  const raw = decodePoolAccount("PoolState", info);
  const wsolFirst = poolKey(raw.token_0_mint).equals(NATIVE_MINT);
  check(wsolFirst ? poolKey(raw.token_1_mint).equals(USDC_MINT)
    : poolKey(raw.token_0_mint).equals(USDC_MINT) && poolKey(raw.token_1_mint).equals(NATIVE_MINT), "Wrong pool mints");
  check(poolKey(raw.token_0_program).equals(TOKEN_PROGRAM_ID) && poolKey(raw.token_1_program).equals(TOKEN_PROGRAM_ID), "Unsupported token program");
  const inputIndex = wsolFirst ? 0 : 1;
  const outputIndex = 1 - inputIndex;
  check(raw[`mint_${inputIndex}_decimals`] === 9 && raw[`mint_${outputIndex}_decimals`] === 6, "Wrong pool decimals");
  const [authority, bump] = PublicKey.findProgramAddressSync([Buffer.from("vault_and_lp_mint_auth_seed")], RAYDIUM_ID);
  check(raw.auth_bump === bump && [0, 1, 2].includes(Number(raw.creator_fee_on)), "Invalid pool authority or fee mode");
  const fees = (index: number) => u64(poolUnits(raw[`protocol_fees_token_${index}`])
    + poolUnits(raw[`fund_fees_token_${index}`]) + poolUnits(raw[`creator_fees_token_${index}`]));
  return { raw, authority, ammConfig: poolKey(raw.amm_config), observation: poolKey(raw.observation_key),
    poolWsolVault: poolKey(raw[`token_${inputIndex}_vault`]), poolUsdcVault: poolKey(raw[`token_${outputIndex}_vault`]),
    inputFees: fees(inputIndex), outputFees: fees(outputIndex), openTime: poolUnits(raw.open_time),
    enabled: typeof raw.status === "number" && (raw.status & 4) === 0,
    creatorFeeOnInput: raw.creator_fee_on === 0 || raw.creator_fee_on === inputIndex + 1 };
}
