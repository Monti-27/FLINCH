import anchor from "@coral-xyz/anchor";
import { IdlCoder } from "@coral-xyz/anchor/dist/cjs/coder/borsh/idl.js";
import { NATIVE_MINT, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, Keypair } from "@solana/web3.js";
import type { LiteSVM } from "litesvm";
import type { Idl } from "@coral-xyz/anchor";
import { BN, RAYDIUM_ID, raydiumIdl, USDC } from "./runtime.ts";
import { seedReserveFixture } from "./tokens.ts";

export function encodeFixture(idl: Idl, name: string, value: unknown) {
  const coder = new anchor.BorshAccountsCoder(idl);
  const typeDef = idl.types?.find(type => type.name === name);
  if (!typeDef) throw new Error(`Missing type ${name}`);
  const layout = IdlCoder.typeDefLayout({ typeDef, types: idl.types ?? [] });
  const payload = Buffer.alloc(coder.size(name) - 8);
  layout.encode(value, payload);
  return Buffer.concat([coder.accountDiscriminator(name), payload]);
}

export async function seedPoolFixture(svm: LiteSVM) {
  const pool = Keypair.generate().publicKey;
  const ammConfig = Keypair.generate().publicKey;
  const observation = Keypair.generate().publicKey;
  const poolWsolVault = Keypair.generate().publicKey;
  const poolUsdcVault = Keypair.generate().publicKey;
  const [authority, bump] = PublicKey.findProgramAddressSync([Buffer.from("vault_and_lp_mint_auth_seed")], RAYDIUM_ID);
  const zero = new BN(0);
  const fixtures: [PublicKey, string, unknown][] = [
    [ammConfig, "AmmConfig", { bump: 0, disable_create_pool: false, index: 0, trade_fee_rate: new BN(2500),
      protocol_fee_rate: new BN(120_000), fund_fee_rate: new BN(40_000), create_pool_fee: zero,
      protocol_owner: authority, fund_owner: authority, creator_fee_rate: zero, padding: Array(15).fill(zero) }],
    [pool, "PoolState", { amm_config: ammConfig, pool_creator: authority, token_0_vault: poolWsolVault,
      token_1_vault: poolUsdcVault, lp_mint: Keypair.generate().publicKey, token_0_mint: NATIVE_MINT,
      token_1_mint: USDC, token_0_program: TOKEN_PROGRAM_ID, token_1_program: TOKEN_PROGRAM_ID,
      observation_key: observation, auth_bump: bump, status: 0, lp_mint_decimals: 9,
      mint_0_decimals: 9, mint_1_decimals: 6, lp_supply: new BN(1_000_000_000),
      protocol_fees_token_0: zero, protocol_fees_token_1: zero, fund_fees_token_0: zero, fund_fees_token_1: zero,
      open_time: zero, recent_epoch: zero, creator_fee_on: 0, enable_creator_fee: false, padding1: Array(6).fill(0),
      creator_fees_token_0: zero, creator_fees_token_1: zero, padding: Array(28).fill(zero) }],
    [observation, "ObservationState", { initialized: false, observation_index: 0, pool_id: pool,
      observations: Array.from({ length: 100 }, () => ({ block_timestamp: zero, cumulative_token_0_price_x32: zero,
        cumulative_token_1_price_x32: zero })), last_update_timestamp: zero, padding: Array(3).fill(zero) }],
  ];
  for (const [key, name, value] of fixtures) {
    const data = encodeFixture(raydiumIdl, name, value);
    svm.setAccount(key, { data, executable: false, owner: RAYDIUM_ID,
      lamports: Number(svm.minimumBalanceForRentExemption(BigInt(data.length))) });
  }
  seedReserveFixture(svm, poolWsolVault, NATIVE_MINT, authority, 100_000_000_000n);
  seedReserveFixture(svm, poolUsdcVault, USDC, authority, 20_000_000_000n);
  return { pool, ammConfig, observation, authority, poolWsolVault, poolUsdcVault };
}
