import { test } from "node:test";
import assert from "node:assert/strict";
import { Connection, Keypair, PublicKey, SYSVAR_CLOCK_PUBKEY } from "@solana/web3.js";
import type { AccountInfo } from "@solana/web3.js";
import { roomFixture, joinIx, startIx } from "../local/support/room.ts";
import { success } from "../local/support/runtime.ts";
import { createProgram } from "../../packages/client/src/program.ts";
import { decodeLedger, decodeControl, matchesLedger } from "../../packages/client/src/accounts/decode.ts";
import { readPoolAccounts } from "../../packages/client/src/accounts/pool.ts";
import { controlInstructions } from "../../packages/client/src/instructions/control.ts";
import { readBaseRoom } from "../../packages/client/src/accounts/read.ts";
import type { LiteSVM } from "litesvm";

function read(svm: LiteSVM, key: PublicKey): AccountInfo<Buffer> | null {
  const account = svm.getAccount(key);
  return account ? { ...account, data: Buffer.from(account.data) } : null;
}

test("generated client decodes real SBF-created accounts and binds their identity", async () => {
  const room = await roomFixture();
  const program = createProgram(new Connection("http://127.0.0.1:8899"));
  const ledger = decodeLedger(program, room.ledger, read(room.svm, room.ledger));
  assert.equal(ledger.stake, 1_000_000n);
  assert.equal(ledger.phase, "funding");
  assert.throws(() => decodeLedger(program, Keypair.generate().publicKey, read(room.svm, room.ledger)));
  assert.throws(() => decodeLedger(program, room.ledger, { ...read(room.svm, room.ledger)!, owner: Keypair.generate().publicKey }));
  for (let seat = 0; seat < 4; seat++) success(room.svm, [await joinIx(room, seat)], [room.players[seat]]);
  success(room.svm, [await startIx(room)], [room.players[0]]);
  const started = decodeLedger(program, room.ledger, read(room.svm, room.ledger));
  const control = decodeControl(program, started, read(room.svm, room.control));
  assert(matchesLedger(control, started));
  assert(!matchesLedger({ ...control, revision: 9n }, started));
  assert(!matchesLedger({ ...control, holdings: [1n, 2n, 3n, 4n] }, started));
  const built = await controlInstructions(program).start(room.ledger, room.players[0].publicKey);
  assert.deepEqual(built, await startIx(room));
  const raw = program.coder.accounts.decode("roomControl", read(room.svm, room.control)!.data);
  for (const overrides of [{ phase: { frozen: {} }, sellers: 0 }, { sellers: 1 }, { attempts: [0, 0, 0, 0], nonces: [raw.revision.addn(1), raw.revision, raw.revision, raw.revision] }]) {
    const data = await program.coder.accounts.encode("roomControl", { ...raw, ...overrides });
    assert.throws(() => decodeControl(program, started, { ...read(room.svm, room.control)!, data }));
  }
});

test("base recovery reads do not depend on decoding damaged Control", async () => {
  const room = await roomFixture();
  for (let seat = 0; seat < 4; seat++) success(room.svm, [await joinIx(room, seat)], [room.players[seat]]);
  success(room.svm, [await startIx(room)], [room.players[0]]);
  const base = new Connection("http://127.0.0.1:8899");
  const ledger = decodeLedger(createProgram(base), room.ledger, read(room.svm, room.ledger));
  const clock = Buffer.alloc(40);
  clock.writeBigInt64LE(ledger.economics!.startedAt + 120n, 32);
  base.getMultipleAccountsInfoAndContext = async keys => ({ context: { slot: 50 }, value: keys.map(key => key.equals(room.ledger)
    ? read(room.svm, room.ledger) : key.equals(SYSVAR_CLOCK_PUBKEY)
      ? { data: clock, owner: new PublicKey("Sysvar1111111111111111111111111111111111111"), executable: false, lamports: 1 }
      : { data: Buffer.from("damaged"), owner: PublicKey.default, executable: false, lamports: 1 }) });
  assert.equal((await readBaseRoom(base, room.ledger)).control.kind, "not_required");
  clock.writeBigInt64LE(ledger.economics!.startedAt + 119n, 32);
  await assert.rejects(readBaseRoom(base, room.ledger), /not owned/);
});

test("Raydium account adapter reads actual fixture layout and rejects a substituted pool", async () => {
  const room = await roomFixture();
  const connection = new Connection("http://127.0.0.1:8899");
  connection.getAccountInfo = async key => read(room.svm, key);
  connection.getMultipleAccountsInfo = async keys => keys.map(key => read(room.svm, key));
  const pool = await readPoolAccounts(connection, room.pool.pool);
  assert(pool.poolWsolVault.equals(room.pool.poolWsolVault));
  assert(pool.authority.equals(room.pool.authority));
  await assert.rejects(readPoolAccounts(connection, room.ledger));
});
