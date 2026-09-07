import { SystemProgram } from "@solana/web3.js";
import type { PublicKey } from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";
import { DELEGATION_PROGRAM_ID, MAGIC_PROGRAM_ID, MAGIC_CONTEXT_ID, delegationRecordPdaFromDelegatedAccount,
  delegationMetadataPdaFromDelegatedAccount, delegateBufferPdaFromDelegatedAccountAndOwnerProgram } from "@magicblock-labs/ephemeral-rollups-sdk";
import { controlAddress, vaults, receiptAddress } from "../addresses.ts";
import { integer } from "../program.ts";
import type { FlinchProgram } from "../program.ts";
import { check } from "../errors.ts";
import { u64 } from "../amounts.ts";

export function controlInstructions(program: FlinchProgram) {
  return {
    start(ledger: PublicKey, payer: PublicKey) {
      return program.methods.startRound().accountsStrict({ payer, ledger, control: controlAddress(ledger, program.programId)[0], mint: NATIVE_MINT,
        vault: vaults(ledger).wsolVault, systemProgram: SystemProgram.programId }).instruction();
    },
    delegate(ledger: PublicKey, payer: PublicKey) {
      const control = controlAddress(ledger, program.programId)[0];
      return program.methods.delegateControl().accountsStrict({ payer, ledger, control, ownerProgram: program.programId,
        delegationProgram: DELEGATION_PROGRAM_ID, systemProgram: SystemProgram.programId,
        delegationRecordControl: delegationRecordPdaFromDelegatedAccount(control),
        delegationMetadataControl: delegationMetadataPdaFromDelegatedAccount(control),
        bufferControl: delegateBufferPdaFromDelegatedAccountAndOwnerProgram(control, program.programId) }).instruction();
    },
    queue(ledger: PublicKey, signer: PublicKey, seat: number, nonce: bigint, minimum: bigint, sessionToken: PublicKey | null = null) {
      check(Number.isInteger(seat) && seat >= 0 && seat < 4 && nonce > 0n && minimum > 0n, "Invalid sell intent");
      return program.methods.queueSell(seat, integer(u64(nonce)), integer(u64(minimum))).accountsStrict({ signer,
        control: controlAddress(ledger, program.programId)[0], sessionToken }).instruction();
    },
    freeze(ledger: PublicKey, payer: PublicKey) {
      return program.methods.freezeBatch().accountsStrict({ payer, control: controlAddress(ledger, program.programId)[0],
        magicProgram: MAGIC_PROGRAM_ID, magicContext: MAGIC_CONTEXT_ID }).instruction();
    },
    expire(ledger: PublicKey, revision: bigint, payer: PublicKey) {
      return program.methods.expireBatch().accountsStrict({ payer, ledger, control: controlAddress(ledger, program.programId)[0],
        receipt: receiptAddress(ledger, revision, program.programId), systemProgram: SystemProgram.programId }).instruction();
    },
    recover(ledger: PublicKey) {
      return program.methods.recoverRound().accountsStrict({ ledger }).instruction();
    },
    cancel(ledger: PublicKey, payer: PublicKey) {
      return program.methods.cancelRoom().accountsStrict({ caller: payer, ledger }).instruction();
    },
  };
}
