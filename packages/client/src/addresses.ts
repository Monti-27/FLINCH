import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, NATIVE_MINT } from "@solana/spl-token";
import { PROGRAM_ID, USDC_MINT } from "./program.ts";
import { encodeU64 } from "./amounts.ts";

const seed = (value: string) => new TextEncoder().encode(value);
export const ledgerAddress = (host: PublicKey, nonce: bigint, programId = PROGRAM_ID) => PublicKey.findProgramAddressSync([seed("ledger-v2"), host.toBytes(), encodeU64(nonce)], programId);
export const controlAddress = (ledger: PublicKey, programId = PROGRAM_ID) => PublicKey.findProgramAddressSync([seed("control-v2"), ledger.toBytes()], programId);
export const receiptAddress = (ledger: PublicKey, revision: bigint, programId = PROGRAM_ID) => PublicKey.findProgramAddressSync([seed("receipt-v2"), ledger.toBytes(), encodeU64(revision)], programId)[0];
export const vaults = (ledger: PublicKey) => ({
  wsolVault: getAssociatedTokenAddressSync(NATIVE_MINT, ledger, true),
  usdcVault: getAssociatedTokenAddressSync(USDC_MINT, ledger, true),
});
