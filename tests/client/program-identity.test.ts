import { test } from "node:test";
import assert from "node:assert/strict";
import { Connection, Keypair } from "@solana/web3.js";
import { createProgram, PROGRAM_ID, DEVNET_PROGRAM_ID, programIdFor } from "../../packages/client/src/program.ts";
import { ledgerAddress, controlAddress } from "../../packages/client/src/addresses.ts";
import { custodyInstructions } from "../../packages/client/src/instructions/custody.ts";
import { controlInstructions } from "../../packages/client/src/instructions/control.ts";
import { decodeLedger } from "../../packages/client/src/accounts/decode.ts";
import { discoverRooms } from "../../packages/client/src/discovery.ts";
import { roomFixture } from "../local/support/room.ts";

test("network identities remain distinct throughout instructions and PDA derivation", async () => {
  const base = new Connection("http://127.0.0.1:8899");
  const host = Keypair.generate().publicKey;
  assert(programIdFor("devnet").equals(DEVNET_PROGRAM_ID));
  assert(programIdFor("localnet").equals(PROGRAM_ID));
  const local = ledgerAddress(host, 17n)[0];
  const devnet = ledgerAddress(host, 17n, DEVNET_PROGRAM_ID)[0];
  assert(!local.equals(devnet));
  for (const id of [PROGRAM_ID, DEVNET_PROGRAM_ID]) {
    const program = createProgram(base, id);
    const ledger = ledgerAddress(host, 17n, id)[0];
    const initialize = await custodyInstructions(program).initialize(host, 17n, 1_000_000n, host, host);
    const delegate = await controlInstructions(program).delegate(ledger, host);
    assert(initialize.programId.equals(id));
    assert(initialize.keys.some(key => key.pubkey.equals(ledger)));
    assert(delegate.keys.some(key => key.pubkey.equals(controlAddress(ledger, id)[0])));
    assert(delegate.keys.some(key => key.pubkey.equals(id)));
  }
  assert.throws(() => createProgram(base, host), /Unsupported/);
});

test("discovery filters the selected program and rejects substituted scope and ownership", async () => {
  const fixture = await roomFixture();
  const base = new Connection("http://127.0.0.1:8899");
  const program = createProgram(base, DEVNET_PROGRAM_ID);
  const original = fixture.svm.getAccount(fixture.ledger)!;
  const raw = program.coder.accounts.decode("roomLedger", Buffer.from(original.data));
  const [address, bump] = ledgerAddress(raw.host, BigInt(raw.nonce.toString()), DEVNET_PROGRAM_ID);
  const data = await program.coder.accounts.encode("roomLedger", { ...raw, bump });
  assert(data.subarray(50, 82).equals(raw.validator.toBuffer()));
  assert(data.subarray(82, 114).equals(raw.pool.toBuffer()));
  let account = { ...original, data, owner: DEVNET_PROGRAM_ID };
  const scope = { validator: raw.validator, pool: raw.pool };
  base.getProgramAccounts = (async (id: typeof address, options: unknown) => {
    assert(id.equals(DEVNET_PROGRAM_ID));
    const filters = (options as { filters: unknown[] }).filters;
    assert.deepEqual(filters.slice(1), [{ memcmp: { offset: 50, bytes: scope.validator.toBase58() } }, { memcmp: { offset: 82, bytes: scope.pool.toBase58() } }]);
    return [{ pubkey: address, account }];
  }) as unknown as typeof base.getProgramAccounts;
  assert.deepEqual(await discoverRooms(base, scope), [address]);
  assert.throws(() => decodeLedger(createProgram(base), address, account), /not owned/);
  await assert.rejects(discoverRooms(base, { ...scope, pool: Keypair.generate().publicKey }));
  account = { ...account, data: await program.coder.accounts.encode("roomLedger", { ...raw, bump, phase: { cancelled: {} } }) };
  assert.deepEqual(await discoverRooms(base, scope), []);
  account = { ...account, owner: PROGRAM_ID };
  await assert.rejects(discoverRooms(base, scope), /not owned/);
});
