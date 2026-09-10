import assert from "node:assert/strict";
import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { NATIVE_MINT, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { DELEGATION_PROGRAM_ID, MAGIC_PROGRAM_ID, MAGIC_CONTEXT_ID,
  getDelegationRecord, DelegationStatus, delegationRecordPdaFromDelegatedAccount,
  delegationMetadataPdaFromDelegatedAccount, delegateBufferPdaFromDelegatedAccountAndOwnerProgram } from "@magicblock-labs/ephemeral-rollups-sdk";
import { BN, PROGRAM_ID, RAYDIUM_ID, USDC, program } from "../local/support/runtime.ts";
import { chainTime, poll, send } from "./rpc.ts";
import { readLedger } from "./room.ts";
import { observeCommitment } from "./commitment.ts";
import type { ChainRoom } from "./room.ts";

export async function playBatch(room: ChainRoom, seats: number[], useSession: boolean, expire = false, nonce = 1) {
  const { base, er, directory, host, pool } = room.stack;
  const expected = (await readLedger(room)).economics!.revision;
  const delegate = await program.methods.delegateControl().accountsStrict({ payer: host.publicKey, ledger: room.ledger,
    control: room.control, ownerProgram: PROGRAM_ID, delegationProgram: DELEGATION_PROGRAM_ID,
    delegationRecordControl: delegationRecordPdaFromDelegatedAccount(room.control),
    delegationMetadataControl: delegationMetadataPdaFromDelegatedAccount(room.control),
    bufferControl: delegateBufferPdaFromDelegatedAccountAndOwnerProgram(room.control, PROGRAM_ID),
    systemProgram: SystemProgram.programId }).instruction();
  await send(base, [delegate], [host], directory, `delegate revision ${expected.toString()}`);
  await poll("verify local placement", async () => {
    const record = await getDelegationRecord(base, room.control);
    if (record.status !== DelegationStatus.Delegated) return;
    assert(record.validator.equals(room.validator));
    assert.equal((await er.getClosestValidator()).identity, record.validator.toBase58());
    const account = await er.getAccountInfo(room.control);
    if (!account?.owner.equals(PROGRAM_ID)) return;
    const state = program.coder.accounts.decode("roomControl", account.data);
    return state.revision.eq(expected) && state.phase.live !== undefined ? true : undefined;
  });
  assert((await base.getAccountInfo(room.control))!.owner.equals(DELEGATION_PROGRAM_ID));
  const signers = useSession ? [room.session] : seats.map(seat => room.players[seat]);
  const queue = await Promise.all(seats.map(seat => program.methods.queueSell(seat, new BN(nonce), new BN(1))
    .accountsStrict({ signer: useSession ? room.session.publicKey : room.players[seat].publicKey,
      control: room.control, sessionToken: useSession ? room.authorization.address : null }).instruction()));
  await send(er, queue, signers, directory, "queue real ER intents");
  const pending = program.coder.accounts.decode("roomControl", (await er.getAccountInfo(room.control))!.data);
  const closesAt = BigInt(pending.startedAt.toString()) + BigInt(pending.cohortIndex + 1) * 2n;
  await poll("cohort close", async () => await chainTime(er) >= closesAt ? true : undefined);
  const freeze = await program.methods.freezeBatch().accountsStrict({ payer: host.publicKey, control: room.control,
    magicProgram: MAGIC_PROGRAM_ID, magicContext: MAGIC_CONTEXT_ID }).instruction();
  const erSignature = await send(er, [freeze], [host], directory, "freeze and return control");
  const commitment = await observeCommitment(er, base, erSignature, directory);
  await poll("control ownership restored", async () => {
    const account = await base.getAccountInfo(room.control);
    if (!account?.owner.equals(PROGRAM_ID)) return;
    const state = program.coder.accounts.decode("roomControl", account.data);
    return state.phase.frozen !== undefined && state.revision.eq(expected) ? true : undefined;
  });
  const returnedAt = await chainTime(base);
  appendFileSync(resolve(directory, "timing.jsonl"), JSON.stringify({ revision: expected.toString(),
    closesAt: closesAt.toString(), returnedAt: returnedAt.toString(),
    erTime: (await chainTime(er)).toString() }) + "\n", { mode: 0o600 });
  const receipt = PublicKey.findProgramAddressSync([Buffer.from("receipt-v2"), room.ledger.toBuffer(), expected.toArrayLike(Buffer, "le", 8)], PROGRAM_ID)[0];
  if (expire) {
    const before = (await readLedger(room)).economics!;
    const balances = await Promise.all([room.wsolVault, room.usdcVault].map(key => base.getTokenAccountBalance(key)));
    await poll("base expiry window", async () => await chainTime(base) >= closesAt + 15n ? true : undefined);
    const ix = await program.methods.expireBatch().accountsStrict({ payer: host.publicKey,
      ledger: room.ledger, control: room.control, receipt, systemProgram: SystemProgram.programId }).instruction();
    await send(base, [ix], [host], directory, "expire returned batch without penalty");
    const after = (await readLedger(room)).economics!;
    assert.deepEqual(after.holdings, before.holdings);
    assert.deepEqual(after.usdcClaims, before.usdcClaims);
    assert(after.revision.eq(expected.addn(1)));
    for (const [i, key] of [room.wsolVault, room.usdcVault].entries()) {
      assert.equal((await base.getTokenAccountBalance(key)).value.amount, balances[i].value.amount);
    }
    return;
  }
  await poll("base execution window", async () => {
    const now = await chainTime(base);
    assert(now < closesAt + 15n, "Returned batch has expired on base");
    return now >= closesAt ? true : undefined;
  });
  const execute = await program.methods.executeBatch().accountsStrict({ payer: host.publicKey,
    ledger: room.ledger, control: room.control, receipt, wsolMint: NATIVE_MINT, usdcMint: USDC,
    wsolVault: room.wsolVault, usdcVault: room.usdcVault, ...pool, raydiumProgram: RAYDIUM_ID,
    tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId }).instruction();
  await send(base, [execute], [host], directory, "execute Raydium batch");
  const updated = await readLedger(room);
  assert(updated.economics!.revision.eq(expected.addn(1)));
  appendFileSync(resolve(directory, "handoffs.jsonl"), JSON.stringify({ revision: expected.toString(), commitment,
    erSignature, validator: room.validator.toBase58(), localEndpoint: er.rpcEndpoint,
    returnedOwner: PROGRAM_ID.toBase58(), afterLedger: updated }) + "\n", { mode: 0o600 });
}

export async function claimAll(room: ChainRoom) {
  const { base, directory } = room.stack;
  const state = (await readLedger(room)).economics!;
  assert.equal(state.terminalTag, 1);
  for (let seat = 0; seat < 4; seat++) {
    const wsol = seat === state.terminalSeat;
    const method = wsol ? program.methods.claimWsol() : program.methods.claimUsdc();
    const expected = wsol ? state.holdings[seat] : state.usdcClaims[seat];
    const destination = wsol ? room.tokens[seat].wsol : room.tokens[seat].usdc;
    const before = BigInt((await base.getTokenAccountBalance(destination)).value.amount);
    const ix = await method.accountsStrict({ player: room.players[seat].publicKey, ledger: room.ledger,
      mint: wsol ? NATIVE_MINT : USDC, vault: wsol ? room.wsolVault : room.usdcVault,
      destination, tokenProgram: TOKEN_PROGRAM_ID }).instruction();
    await send(base, [ix], [room.players[seat]], directory, "claim actual token entitlement");
    const after = BigInt((await base.getTokenAccountBalance(destination)).value.amount);
    assert.equal(after - before, BigInt(expected.toString()));
  }
  assert.equal((await base.getTokenAccountBalance(room.wsolVault)).value.amount, "0");
  assert.equal((await base.getTokenAccountBalance(room.usdcVault)).value.amount, "0");
}
