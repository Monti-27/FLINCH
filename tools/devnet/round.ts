import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { SystemProgram } from "@solana/web3.js";
import type { Keypair } from "@solana/web3.js";
import { NATIVE_MINT, createAssociatedTokenAccountIdempotentInstruction, createSyncNativeInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { ClientError, ledgerAddress, vaults, USDC_MINT } from "../../packages/client/src/index.ts";
import type { FlinchClient } from "../../packages/client/src/index.ts";
import { buildSession, revokeSession } from "../../apps/web/src/lib/session.ts";
import { DEVNET } from "./settings.ts";
import { sendRecorded, submitRecorded, record, waitFor } from "./operations.ts";
import { prepareDevnetSell } from "./sell.ts";

export async function playDevnetRound(client: FlinchClient, players: Keypair[], directory: string, index: number, signal: AbortSignal) {
  const nonce = randomBytes(8).readBigUInt64LE();
  const host = players[0];
  const ledger = ledgerAddress(host.publicKey, nonce, client.programId)[0];
  const name = `round-${index}`;
  await record(directory, { event: "round-plan", index, ledger, nonce, players: players.map(key => key.publicKey), stake: 1_000_000n });
  await sendRecorded(directory, `${name}-create`, client.base,
    [await client.instructions.initialize(host.publicKey, nonce, 1_000_000n, DEVNET.validator, DEVNET.pool)], [host], signal);
  const initial = await client.readRoom(ledger);
  const built = await buildSession(client.base, host.publicKey, ledger, initial.now, client.programId);
  for (let seat = 0; seat < players.length; seat++) {
    const key = players[seat];
    const wsol = getAssociatedTokenAddressSync(NATIVE_MINT, key.publicKey);
    const instructions = [createAssociatedTokenAccountIdempotentInstruction(key.publicKey, wsol, key.publicKey, NATIVE_MINT),
      SystemProgram.transfer({ fromPubkey: key.publicKey, toPubkey: wsol, lamports: 1_000_000n }), createSyncNativeInstruction(wsol),
      await client.instructions.join(ledger, key.publicKey)];
    if (seat === 0) instructions.push(built.instruction, await client.instructions.session(ledger, key.publicKey, built.session.signer.publicKey));
    await sendRecorded(directory, `${name}-join-${seat}`, client.base, instructions, seat === 0 ? [key, built.session.signer] : [key], signal);
  }
  for (const [batch, seats] of [[0, [0]], [1, [1, 2]]] as const) {
    await waitFor("fresh delegated Control", async () => {
      const room = await client.readRoom(ledger);
      if (room.control.kind !== "delegated" || room.ledger.economics?.revision !== BigInt(batch)) return;
      try { return await client.resolve(room, signal); }
      catch (error) { if (!(error instanceof ClientError) || error.code !== "placement_pending") throw error; }
    }, signal);
    const keys = batch === 0 ? [built.session.signer] : seats.map(seat => players[seat]);
    const sale = await prepareDevnetSell(client, ledger, seats, keys, batch === 0 ? built.session : undefined, directory, index, batch, signal);
    await submitRecorded(directory, `${name}-sell-${batch}`, sale.connection, sale.prepared, signal);
    const after = await waitFor("confirmed swap revision", async () => {
      const room = await client.readRoom(ledger);
      assert(room.ledger.economics!.terminalTag === 0 || room.ledger.economics!.terminalTag === 1, "Round recovered before expected swap");
      return room.ledger.economics!.revision > BigInt(batch) ? room : undefined;
    }, signal);
    for (const quote of sale.quotes) assert(after.ledger.economics!.usdcClaims[quote.seat] >= quote.minimumOutput);
    await record(directory, { event: "settled-batch", index, batch, ledger: after.ledger, receipts: await client.receipts(after) });
  }
  const terminal = (await client.readRoom(ledger)).ledger.economics!;
  assert.equal(terminal.terminalTag, 1);
  assert.equal(terminal.terminalSeat, 3);
  for (let seat = 0; seat < players.length; seat++) {
    const key = players[seat];
    const asset = seat === 3 ? "wsol" : "usdc";
    const mint = asset === "wsol" ? NATIVE_MINT : USDC_MINT;
    const destination = getAssociatedTokenAddressSync(mint, key.publicKey);
    const info = await client.base.getAccountInfo(destination, "confirmed");
    const before = info ? BigInt((await client.base.getTokenAccountBalance(destination)).value.amount) : 0n;
    await sendRecorded(directory, `${name}-claim-${seat}`, client.base,
      [createAssociatedTokenAccountIdempotentInstruction(key.publicKey, destination, key.publicKey, mint),
        await client.instructions.claim(ledger, key.publicKey, asset)], [key], signal);
    const after = BigInt((await client.base.getTokenAccountBalance(destination)).value.amount);
    assert.equal(after - before, asset === "wsol" ? terminal.holdings[seat] : terminal.usdcClaims[seat]);
    await record(directory, { event: "claim", index, seat, asset, before, after });
  }
  for (const address of Object.values(vaults(ledger))) assert.equal((await client.base.getTokenAccountBalance(address)).value.amount, "0");
  await sendRecorded(directory, `${name}-revoke`, client.base, [await revokeSession(client.base, host.publicKey, built.session.token)], [host], signal);
  const session = await client.base.getAccountInfo(built.session.token, "confirmed");
  assert(!session || session.lamports === 0);
  await record(directory, { event: "round-complete", index, ledger, swaps: 2, claims: 4, sessionRevoked: true });
  return ledger;
}
