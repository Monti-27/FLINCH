import { NATIVE_MINT, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { BN, PROGRAM_ID, RAYDIUM_ID, USDC, controlState, data, ledgerState, program, runtime, success, wallet } from "./runtime.ts";
import { seedPoolFixture } from "./pool.ts";
import { playerTokens, seedUsdcFixture } from "./tokens.ts";
import type { LiteSVM } from "litesvm";

export async function roomFixture(stake = 1_000_000n) {
  const svm = runtime();
  seedUsdcFixture(svm);
  const pool = await seedPoolFixture(svm);
  const players = Array.from({ length: 4 }, () => wallet(svm));
  const tokens = players.map(player => playerTokens(svm, player));
  const nonce = Buffer.alloc(8);
  const [ledger] = PublicKey.findProgramAddressSync([Buffer.from("ledger-v2"), players[0].publicKey.toBuffer(), nonce], PROGRAM_ID);
  const [control] = PublicKey.findProgramAddressSync([Buffer.from("control-v2"), ledger.toBuffer()], PROGRAM_ID);
  const wsolVault = getAssociatedTokenAddressSync(NATIVE_MINT, ledger, true);
  const usdcVault = getAssociatedTokenAddressSync(USDC, ledger, true);
  const initialize = await program.methods.initializeRoom({ nonce: new BN(0), stake: new BN(stake.toString()), validator: players[0].publicKey })
    .accountsStrict({ host: players[0].publicKey, ledger, pool: pool.pool,
      wsolMint: NATIVE_MINT, usdcMint: USDC, wsolVault, usdcVault,
      tokenProgram: TOKEN_PROGRAM_ID, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId }).instruction();
  success(svm, [initialize], [players[0]]);
  return { svm, players, tokens, ledger, control, wsolVault, usdcVault, pool, stake, initialize };
}

export type Room = Awaited<ReturnType<typeof roomFixture>>;

export function joinIx(room: Room, seat: number) {
  return program.methods.joinRoom().accountsStrict({ player: room.players[seat].publicKey,
    ledger: room.ledger, mint: NATIVE_MINT, source: room.tokens[seat].wsol,
    vault: room.wsolVault, tokenProgram: TOKEN_PROGRAM_ID }).instruction();
}

export function startIx(room: Room) {
  return program.methods.startRound().accountsStrict({ payer: room.players[0].publicKey,
    ledger: room.ledger, control: room.control, mint: NATIVE_MINT, vault: room.wsolVault,
    systemProgram: SystemProgram.programId }).instruction();
}

export async function fundAndStart(room: Room) {
  for (let seat = 0; seat < 4; seat++) success(room.svm, [await joinIx(room, seat)], [room.players[seat]]);
  success(room.svm, [await startIx(room)], [room.players[0]]);
}

export function claimIx(room: Room, seat: number, wsol: boolean) {
  const method = wsol ? program.methods.claimWsol() : program.methods.claimUsdc();
  return method.accountsStrict({ player: room.players[seat].publicKey, ledger: room.ledger,
    mint: wsol ? NATIVE_MINT : USDC, vault: wsol ? room.wsolVault : room.usdcVault,
    destination: wsol ? room.tokens[seat].wsol : room.tokens[seat].usdc, tokenProgram: TOKEN_PROGRAM_ID }).instruction();
}

export function receiptKey(room: Room, revision = ledgerState(room.svm, room.ledger).economics!.revision) {
  return PublicKey.findProgramAddressSync([Buffer.from("receipt-v2"), room.ledger.toBuffer(), revision.toArrayLike(Buffer, "le", 8)], PROGRAM_ID)[0];
}

export async function injectReturnedControlFixture(room: Room, sellers: number, minimums?: bigint[], cohortIndex?: number) {
  const current = controlState(room.svm, room.control);
  const state = ledgerState(room.svm, room.ledger).economics!;
  current.phase = { frozen: {} };
  current.revision = state.revision;
  current.holdings = state.holdings;
  current.nextCohort = state.nextCohort;
  current.cohortIndex = cohortIndex ?? state.nextCohort;
  current.sellers = sellers;
  current.minimumOutputs = Array.from({ length: 4 }, (_, i) => new BN((minimums?.[i] ?? (sellers & (1 << i) ? 1n : 0n)).toString()));
  for (let seat = 0; seat < 4; seat++) {
    if (sellers & (1 << seat)) {
      current.attempts[seat]++;
      current.nonces[seat] = current.nonces[seat].addn(1);
    }
  }
  await replaceControlFixture(room, current);
}

export async function replaceControlFixture(room: Room, state: ReturnType<typeof controlState>) {
  const original = room.svm.getAccount(room.control)!;
  const encoded = await program.coder.accounts.encode("roomControl", state);
  const padded = Buffer.alloc(original.data.length);
  encoded.copy(padded);
  room.svm.setAccount(room.control, { ...original, data: padded });
}

export function executeIx(room: Room, receipt = receiptKey(room)) {
  return program.methods.executeBatch().accountsStrict({ payer: room.players[0].publicKey,
    ledger: room.ledger, control: room.control, receipt, wsolMint: NATIVE_MINT, usdcMint: USDC,
    wsolVault: room.wsolVault, usdcVault: room.usdcVault, ...room.pool,
    raydiumProgram: RAYDIUM_ID, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId }).instruction();
}

export function expireIx(room: Room, receipt = receiptKey(room)) {
  return program.methods.expireBatch().accountsStrict({ payer: room.players[0].publicKey,
    ledger: room.ledger, control: room.control, receipt, systemProgram: SystemProgram.programId }).instruction();
}

export function snapshots(svm: LiteSVM, keys: PublicKey[]) {
  return keys.map(key => data(svm, key));
}

export function economicAccounts(room: Room) {
  return [room.ledger, room.control, room.wsolVault, room.usdcVault, room.pool.pool,
    room.pool.poolWsolVault, room.pool.poolUsdcVault, room.pool.observation];
}
