import assert from "node:assert/strict";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { NATIVE_MINT, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, createSyncNativeInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { BN, PROGRAM_ID, USDC, program } from "../local/support/runtime.ts";
import { sessionInstructions } from "../local/support/session.ts";
import { chainTime, send } from "./rpc.ts";
import type { Stack } from "./bootstrap.ts";
import type { IdlAccounts } from "@coral-xyz/anchor";
import type { FlinchV2 } from "../../target/types/flinch_v2.ts";

export async function prepareRoom(stack: Stack, options: { start?: boolean } = {}) {
  const { base, directory, host, pool, er } = stack;
  const players = [host, ...Array.from({ length: 3 }, () => Keypair.generate())];
  const session = Keypair.generate();
  await send(base, [...players.slice(1), session].map(player => SystemProgram.transfer({ fromPubkey: host.publicKey,
    toPubkey: player.publicKey, lamports: 100_000_000n })), [host], directory, "fund local wallets");
  const tokens = [];
  for (const player of players) {
    const wsol = getAssociatedTokenAddressSync(NATIVE_MINT, player.publicKey);
    const usdc = getAssociatedTokenAddressSync(USDC, player.publicKey);
    await send(base, [createAssociatedTokenAccountInstruction(player.publicKey, wsol, player.publicKey, NATIVE_MINT),
      createAssociatedTokenAccountInstruction(player.publicKey, usdc, player.publicKey, USDC),
      SystemProgram.transfer({ fromPubkey: player.publicKey, toPubkey: wsol, lamports: 1_000_000n }),
      createSyncNativeInstruction(wsol)], [player], directory, "wrap stake");
    tokens.push({ wsol, usdc });
  }
  const authorization = await sessionInstructions(host, session, await chainTime(base) + 300n);
  await send(base, [authorization.instruction], [host, session], directory, "create session");
  const validator = new PublicKey((await er.getClosestValidator()).identity);
  const [ledger] = PublicKey.findProgramAddressSync([Buffer.from("ledger-v2"), host.publicKey.toBuffer(), Buffer.alloc(8)], PROGRAM_ID);
  const [control] = PublicKey.findProgramAddressSync([Buffer.from("control-v2"), ledger.toBuffer()], PROGRAM_ID);
  const wsolVault = getAssociatedTokenAddressSync(NATIVE_MINT, ledger, true);
  const usdcVault = getAssociatedTokenAddressSync(USDC, ledger, true);
  const initialize = await program.methods.initializeRoom({ nonce: new BN(0), stake: new BN(1_000_000), validator })
    .accountsStrict({ host: host.publicKey, ledger, pool: pool.pool, wsolMint: NATIVE_MINT, usdcMint: USDC,
      wsolVault, usdcVault, tokenProgram: TOKEN_PROGRAM_ID, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId }).instruction();
  await send(base, [initialize], [host], directory, "initialize room");
  for (let seat = 0; seat < 4; seat++) {
    const ix = await program.methods.joinRoom().accountsStrict({ player: players[seat].publicKey, ledger,
      mint: NATIVE_MINT, source: tokens[seat].wsol, vault: wsolVault, tokenProgram: TOKEN_PROGRAM_ID }).instruction();
    await send(base, [ix], [players[seat]], directory, "join room");
  }
  const bind = await program.methods.setSessionSigner(session.publicKey).accountsStrict({ player: host.publicKey, ledger }).instruction();
  const start = await program.methods.startRound().accountsStrict({ payer: host.publicKey, ledger, control,
    mint: NATIVE_MINT, vault: wsolVault, systemProgram: SystemProgram.programId }).instruction();
  await send(base, options.start === false ? [bind] : [bind, start], [host], directory,
    options.start === false ? "bind session before keeper starts round" : "bind session and start");
  assert.equal((await base.getTokenAccountBalance(wsolVault)).value.amount, "4000000");
  return { stack, players, tokens, session, authorization, validator, ledger, control, wsolVault, usdcVault };
}

export type ChainRoom = Awaited<ReturnType<typeof prepareRoom>>;

export async function readLedger(room: ChainRoom) {
  const info = await room.stack.base.getAccountInfo(room.ledger);
  assert(info);
  return program.coder.accounts.decode<IdlAccounts<FlinchV2>["roomLedger"]>("roomLedger", info.data);
}
