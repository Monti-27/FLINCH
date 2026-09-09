import assert from "node:assert/strict";
import { realpath } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { PublicKey } from "@solana/web3.js";
import { NATIVE_MINT, createAssociatedTokenAccountIdempotentInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { FlinchClient, USDC_MINT, vaults } from "../../packages/client/src/index.ts";
import { boundSessionToken, revokeSession } from "../../apps/web/src/lib/session.ts";
import { FileOperationStore } from "../../apps/keeper/src/file-store.ts";
import { readConfig } from "../../apps/keeper/src/runtime/config.ts";
import { acquireJournal } from "../../apps/keeper/src/runtime/lease.ts";
import { probeDevnet } from "./probe.ts";
import { readKey, privateDirectory } from "./private-files.ts";
import { DEVNET } from "./settings.ts";
import { capture, record, sendRecorded, json } from "./operations.ts";

export async function reclaimRoom(directory: string, room: PublicKey, evidence: string, execute: boolean) {
  if (!execute) throw new Error("Claims require --execute-devnet");
  const location = await privateDirectory(directory);
  const output = await realpath(evidence);
  const inside = relative(await realpath("artifacts/runs"), output);
  assert(inside && !inside.startsWith(`..${sep}`) && inside !== "..");
  const release = await acquireJournal(resolve(location, `claims-${room.toBase58()}`));
  try {
    const preflight = await probeDevnet(location);
    assert(preflight.deployed);
    const client = new FlinchClient({ network: "devnet", baseUrl: preflight.baseUrl, expectedGenesis: preflight.genesis });
    const players = await Promise.all([0, 1, 2, 3].map(seat => readKey(resolve(location, `player-${seat}.json`))));
    let initial = await client.readRoom(room);
    assert(initial.ledger.pool.equals(DEVNET.pool) && initial.ledger.validator.equals(DEVNET.validator));
    players.forEach((player, seat) => assert(initial.ledger.wallets[seat].equals(player.publicKey) || initial.ledger.wallets[seat].equals(PublicKey.default)));
    assert(initial.ledger.host.equals(players[0].publicKey));
    const prefix = `reclaim-${room.toBase58().toLowerCase()}`;
    if (initial.ledger.phase === "funding") {
      await sendRecorded(output, `${prefix}-cancel`, client.base, [await client.instructions.cancel(room, players[0].publicKey)], [players[0]]);
      initial = await client.readRoom(room);
    }
    assert(initial.ledger.phase === "cancelled" || initial.ledger.economics && initial.ledger.economics.terminalTag !== 0,
      "Wait for confirmed base recovery before claiming");
    await record(output, { event: "recovery-claim-plan", room, ledger: initial.ledger });
    for (let seat = 0; seat < 4; seat++) {
      const player = players[seat];
      if (initial.ledger.wallets[seat].equals(PublicKey.default)) continue;
      for (const asset of ["wsol", "usdc"] as const) {
        const state = (await client.readRoom(room)).ledger;
        const expected = state.phase === "cancelled" ? asset === "wsol" && !state.refunded[seat] ? state.stake : 0n
          : asset === "wsol" ? state.economics!.holdings[seat] : state.economics!.usdcClaims[seat];
        if (expected === 0n) continue;
        const mint = asset === "wsol" ? NATIVE_MINT : USDC_MINT;
        const destination = getAssociatedTokenAddressSync(mint, player.publicKey);
        const info = await client.base.getAccountInfo(destination, "confirmed");
        const before = info ? BigInt((await client.base.getTokenAccountBalance(destination)).value.amount) : 0n;
        await sendRecorded(output, `${prefix}-${seat}-${asset}`, client.base,
          [createAssociatedTokenAccountIdempotentInstruction(player.publicKey, destination, player.publicKey, mint),
            await client.instructions.claim(room, player.publicKey, asset)], [player]);
        const after = BigInt((await client.base.getTokenAccountBalance(destination)).value.amount);
        assert.equal(after - before, expected);
        await record(output, { event: "recovery-claim", room, seat, asset, before, after, expected });
      }
      const signer = initial.ledger.sessionSigners[seat];
      if (signer.equals(PublicKey.default)) continue;
      const token = await boundSessionToken(client.base, player.publicKey, signer, client.programId);
      const info = await client.base.getAccountInfo(token, "confirmed");
      if (info && info.lamports > 0) await sendRecorded(output, `${prefix}-${seat}-revoke`, client.base,
        [await revokeSession(client.base, player.publicKey, token)], [player]);
      const revoked = await client.base.getAccountInfo(token, "confirmed");
      assert(!revoked || revoked.lamports === 0);
    }
    for (const address of Object.values(vaults(room))) assert.equal((await client.base.getTokenAccountBalance(address)).value.amount, "0");
    const config = await readConfig(resolve(location, "keeper-config.json"));
    const history = await new FileOperationStore(config.journalDirectory).history(room.toBase58());
    for (const op of new Map(history.filter(op => op.action === "recover").map(op => [op.signature, op])).values())
      await capture(output, client.base, op.signature, "base-recovery");
    const final = await client.readRoom(room);
    await record(output, { event: "recovery-claims-complete", room, ledger: final.ledger, emptyVaults: true, baseOnly: true });
    return { room: room.toBase58(), emptyVaults: true, evidence: output };
  } finally { await release(); }
}

if (process.argv[1] === import.meta.filename) {
  const args = process.argv.slice(2);
  try {
    assert(args.length === 7 && args[0] === "--directory" && args[2] === "--room" && args[4] === "--evidence" && args[6] === "--execute-devnet");
    console.log(json(await reclaimRoom(args[1], new PublicKey(args[3]), args[5], true)));
  } catch { console.error("Claims stopped. Inspect retained submissions and confirmed balances before resuming."); process.exitCode = 1; }
}
