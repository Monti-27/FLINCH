import { AccountLayout, MintLayout, NATIVE_MINT, TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, createSyncNativeInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { SystemProgram } from "@solana/web3.js";
import type { Keypair, PublicKey } from "@solana/web3.js";
import type { LiteSVM } from "litesvm";
import { data, success, USDC } from "./runtime.ts";

export function seedUsdcFixture(svm: LiteSVM) {
  const data = Buffer.alloc(MintLayout.span);
  MintLayout.encode({ mintAuthorityOption: 0, mintAuthority: SystemProgram.programId,
    supply: 1_000_000_000_000n, decimals: 6, isInitialized: true,
    freezeAuthorityOption: 0, freezeAuthority: SystemProgram.programId }, data);
  svm.setAccount(USDC, { data, executable: false, owner: TOKEN_PROGRAM_ID,
    lamports: Number(svm.minimumBalanceForRentExemption(BigInt(data.length))) });
}

export function seedReserveFixture(svm: LiteSVM, key: PublicKey, mint: PublicKey, owner: PublicKey, amount: bigint) {
  const data = Buffer.alloc(AccountLayout.span);
  const rent = svm.minimumBalanceForRentExemption(BigInt(data.length));
  const native = mint.equals(NATIVE_MINT);
  AccountLayout.encode({ mint, owner, amount, delegateOption: 0, delegate: SystemProgram.programId,
    state: 1, isNativeOption: native ? 1 : 0, isNative: native ? rent : 0n,
    delegatedAmount: 0n, closeAuthorityOption: 0, closeAuthority: SystemProgram.programId }, data);
  svm.setAccount(key, { data, executable: false, owner: TOKEN_PROGRAM_ID, lamports: Number(rent + (native ? amount : 0n)) });
}

export function playerTokens(svm: LiteSVM, player: Keypair, amount = 20_000_000n) {
  const wsol = getAssociatedTokenAddressSync(NATIVE_MINT, player.publicKey);
  const usdc = getAssociatedTokenAddressSync(USDC, player.publicKey);
  success(svm, [
    createAssociatedTokenAccountInstruction(player.publicKey, wsol, player.publicKey, NATIVE_MINT),
    createAssociatedTokenAccountInstruction(player.publicKey, usdc, player.publicKey, USDC),
    SystemProgram.transfer({ fromPubkey: player.publicKey, toPubkey: wsol, lamports: amount }),
    createSyncNativeInstruction(wsol),
  ], [player]);
  return { wsol, usdc };
}

export function balance(svm: LiteSVM, key: PublicKey): bigint {
  return AccountLayout.decode(data(svm, key)).amount;
}
