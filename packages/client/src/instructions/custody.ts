import { SystemProgram } from "@solana/web3.js";
import type { PublicKey } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, NATIVE_MINT, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { ledgerAddress, vaults } from "../addresses.ts";
import { integer, USDC_MINT } from "../program.ts";
import type { FlinchProgram } from "../program.ts";
import { u64 } from "../amounts.ts";

export function custodyInstructions(program: FlinchProgram) {
  return {
    initialize(host: PublicKey, nonce: bigint, stake: bigint, validator: PublicKey, pool: PublicKey) {
      const ledger = ledgerAddress(host, nonce, program.programId)[0];
      return program.methods.initializeRoom({ nonce: integer(u64(nonce)), stake: integer(u64(stake)), validator }).accountsStrict({
        host, ledger, pool, wsolMint: NATIVE_MINT, usdcMint: USDC_MINT, ...vaults(ledger),
        tokenProgram: TOKEN_PROGRAM_ID, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId }).instruction();
    },
    join(ledger: PublicKey, player: PublicKey) {
      return program.methods.joinRoom().accountsStrict({ ledger, player, mint: NATIVE_MINT,
        source: getAssociatedTokenAddressSync(NATIVE_MINT, player), vault: vaults(ledger).wsolVault, tokenProgram: TOKEN_PROGRAM_ID }).instruction();
    },
    session(ledger: PublicKey, player: PublicKey, signer: PublicKey) {
      return program.methods.setSessionSigner(signer).accountsStrict({ player, ledger }).instruction();
    },
    claim(ledger: PublicKey, player: PublicKey, asset: "wsol" | "usdc") {
      const mint = asset === "wsol" ? NATIVE_MINT : USDC_MINT;
      const method = asset === "wsol" ? program.methods.claimWsol() : program.methods.claimUsdc();
      return method.accountsStrict({ player, ledger, mint, vault: getAssociatedTokenAddressSync(mint, ledger, true),
        destination: getAssociatedTokenAddressSync(mint, player), tokenProgram: TOKEN_PROGRAM_ID }).instruction();
    },
  };
}
