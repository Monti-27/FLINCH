import anchor from "@coral-xyz/anchor";
import { SessionTokenManager } from "@magicblock-labs/gum-sdk";
import { Connection, SystemProgram } from "@solana/web3.js";
import type { Keypair } from "@solana/web3.js";
import { BN, PROGRAM_ID } from "./runtime.ts";

export async function sessionInstructions(authority: Keypair, signer: Keypair, expiresAt: bigint) {
  const manager = new SessionTokenManager(new anchor.Wallet(authority), new Connection("http://127.0.0.1:8899"));
  const builder = manager.program.methods.createSessionV2(false, new BN(expiresAt.toString()), null)
    .accountsPartial({ authority: authority.publicKey, feePayer: authority.publicKey,
      sessionSigner: signer.publicKey, targetProgram: PROGRAM_ID, systemProgram: SystemProgram.programId });
  const instruction = await builder.instruction();
  const address = (await builder.pubkeys()).sessionToken!;
  const revoke = await manager.program.methods.revokeSessionV2().accountsStrict({ sessionToken: address,
    feePayer: authority.publicKey, authority: authority.publicKey, systemProgram: SystemProgram.programId }).instruction();
  return { instruction, address, revoke, programId: manager.program.programId };
}
