import { SystemProgram } from "@solana/web3.js";
import type { PublicKey } from "@solana/web3.js";
import { NATIVE_MINT, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { controlAddress, receiptAddress, vaults } from "../addresses.ts";
import { RAYDIUM_ID, USDC_MINT } from "../program.ts";
import type { FlinchProgram } from "../program.ts";
import type { PoolAccounts } from "../accounts/pool.ts";

export function executeInstruction(program: FlinchProgram, ledger: PublicKey, revision: bigint, payer: PublicKey, pool: PoolAccounts) {
  return program.methods.executeBatch().accountsStrict({ payer, ledger, control: controlAddress(ledger, program.programId)[0],
    receipt: receiptAddress(ledger, revision, program.programId), wsolMint: NATIVE_MINT, usdcMint: USDC_MINT,
    ...vaults(ledger), ...pool, raydiumProgram: RAYDIUM_ID, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId }).instruction();
}
