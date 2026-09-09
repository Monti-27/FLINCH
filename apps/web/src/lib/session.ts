import * as anchor from "@coral-xyz/anchor";
import { SessionTokenManager } from "@magicblock-labs/gum-sdk";
import { Keypair, SystemProgram } from "@solana/web3.js";
import type { Connection, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { PROGRAM_ID } from "@flinch/client";
import type { TransactionSigner } from "@flinch/client";

export type Session = Readonly<{ signer: Keypair; token: PublicKey; authority: PublicKey; room: PublicKey; expiresAt: bigint }>;
const unsignedWallet = (publicKey: PublicKey) => ({ publicKey,
  signTransaction: async <T extends Transaction | VersionedTransaction>(_tx: T): Promise<T> => { throw new Error("Builder cannot sign"); },
  signAllTransactions: async <T extends Transaction | VersionedTransaction>(_txs: T[]): Promise<T[]> => { throw new Error("Builder cannot sign"); } });

export async function buildSession(base: Connection, authority: PublicKey, room: PublicKey, now: bigint, programId = PROGRAM_ID) {
  const signer = Keypair.generate();
  const expiresAt = now + 600n;
  const manager = new SessionTokenManager(unsignedWallet(authority), base);
  const rent = await base.getMinimumBalanceForRentExemption(0, "confirmed");
  if (!Number.isSafeInteger(rent) || rent < 0) throw new Error("Invalid session signer rent requirement");
  const topUp = BigInt(rent) + 100_000n;
  const builder = manager.program.methods.createSessionV2(true, new anchor.BN(expiresAt.toString()), new anchor.BN(topUp.toString()))
    .accountsPartial({ authority, feePayer: authority, sessionSigner: signer.publicKey, targetProgram: programId, systemProgram: SystemProgram.programId });
  const instruction = await builder.instruction();
  const token = (await builder.pubkeys()).sessionToken!;
  return { session: { signer, token, authority, room, expiresAt } satisfies Session, instruction };
}

export async function revokeSession(base: Connection, authority: PublicKey, token: PublicKey) {
  return new SessionTokenManager(unsignedWallet(authority), base).program.methods.revokeSessionV2().accountsStrict({
    sessionToken: token, feePayer: authority, authority, systemProgram: SystemProgram.programId }).instruction();
}

export async function boundSessionToken(base: Connection, authority: PublicKey, sessionSigner: PublicKey, programId = PROGRAM_ID) {
  const builder = new SessionTokenManager(unsignedWallet(authority), base).program.methods.createSessionV2(false, null, null)
    .accountsPartial({ authority, feePayer: authority, sessionSigner, targetProgram: programId, systemProgram: SystemProgram.programId });
  return (await builder.pubkeys()).sessionToken!;
}

export const sessionSigner = (session: Session): TransactionSigner => ({ publicKey: session.signer.publicKey,
  sign: async tx => { tx.sign([session.signer]); return tx; } });

export function withSession(wallet: TransactionSigner, session?: Session): TransactionSigner {
  if (!session) return wallet;
  return { publicKey: wallet.publicKey, sign: async tx => { tx.sign([session.signer]); return wallet.sign(tx); } };
}
