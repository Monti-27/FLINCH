import { NATIVE_MINT, createAssociatedTokenAccountIdempotentInstruction, createSyncNativeInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { SystemProgram } from "@solana/web3.js";
import type { PublicKey } from "@solana/web3.js";
import type { BaseRoom, FlinchClient } from "@flinch/client";
import { buildSession } from "../../lib/session.ts";

export async function joinInstructions(client: FlinchClient, room: BaseRoom, player: PublicKey, enableSession: boolean) {
  if (room.ledger.phase !== "funding" || room.now >= room.ledger.fundingDeadline) throw new Error("Room is no longer accepting players");
  if (room.ledger.wallets.some(wallet => wallet.equals(player))) throw new Error("This wallet already has a seat");
  const wsol = getAssociatedTokenAddressSync(NATIVE_MINT, player);
  const instructions = [createAssociatedTokenAccountIdempotentInstruction(player, wsol, player, NATIVE_MINT),
    SystemProgram.transfer({ fromPubkey: player, toPubkey: wsol, lamports: room.ledger.stake }), createSyncNativeInstruction(wsol),
    await client.instructions.join(room.ledger.address, player)];
  const built = enableSession ? await buildSession(client.base, player, room.ledger.address, room.now, client.programId) : undefined;
  if (built) instructions.push(built.instruction, await client.instructions.session(room.ledger.address, player, built.session.signer.publicKey));
  return { instructions, session: built?.session };
}
