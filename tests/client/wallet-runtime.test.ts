import { test } from "node:test";
import assert from "node:assert/strict";
import { FailedTransactionMetadata } from "litesvm";
import { Connection, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import type { Keypair, TransactionInstruction } from "@solana/web3.js";
import { prepareTransaction } from "../../packages/client/src/transactions.ts";
import { ledgerAddress, vaults } from "../../packages/client/src/addresses.ts";
import { custodyInstructions } from "../../packages/client/src/instructions/custody.ts";
import { controlInstructions } from "../../packages/client/src/instructions/control.ts";
import { createProgram } from "../../packages/client/src/program.ts";
import { roomFixture } from "../local/support/room.ts";
import { ledgerState, setTime } from "../local/support/runtime.ts";
import { balance } from "../local/support/tokens.ts";
import { observations, recordTransaction } from "../local/support/evidence.ts";

test("budgeted legacy wallet transactions create, deposit, recover and claim through the actual program", async () => {
  const room = await roomFixture();
  const { svm, players } = room;
  const program = createProgram(new Connection("http://127.0.0.1:8899"));
  const custody = custodyInstructions(program);
  const control = controlInstructions(program);
  const ledger = ledgerAddress(players[0].publicKey, 1n)[0];
  let actions = 0;
  async function execute(instructions: TransactionInstruction[], player: Keypair) {
    svm.expireBlockhash();
    const prepared = await prepareTransaction({ getLatestBlockhash: async () => ({ blockhash: svm.latestBlockhash(), lastValidBlockHeight: 42 }) },
      instructions, { publicKey: player.publicKey, sign: async tx => {
        const walletTransaction = Transaction.from(tx.serialize());
        walletTransaction.partialSign(player);
        assert(walletTransaction.verifySignatures());
        return VersionedTransaction.deserialize(walletTransaction.serialize());
      } }, "legacy");
    const preview = svm.simulateTransaction(prepared.transaction);
    if (preview instanceof FailedTransactionMetadata) assert.fail(preview.meta().logs().join("\n"));
    const writable = [...new Map(instructions.flatMap(ix => ix.keys).filter(key => key.isWritable)
      .map(key => [key.pubkey.toBase58(), key.pubkey])).values()];
    const before = observations(svm, writable);
    const result = svm.sendTransaction(prepared.transaction);
    if (result instanceof FailedTransactionMetadata) assert.fail(result.meta().logs().join("\n"));
    recordTransaction(result, true, before, observations(svm, writable));
    actions++;
  }
  await execute([await custody.initialize(players[0].publicKey, 1n, room.stake, players[0].publicKey, room.pool.pool)], players[0]);
  assert(ledgerState(svm, ledger).wallets.every(key => key.equals(PublicKey.default)));
  for (const player of players) await execute([await custody.join(ledger, player.publicKey)], player);
  assert.deepEqual(ledgerState(svm, ledger).wallets, players.map(player => player.publicKey));
  await execute([await control.start(ledger, players[0].publicKey)], players[0]);
  setTime(svm, 1_120n);
  await execute([await control.recover(ledger)], players[0]);
  for (let seat = 0; seat < players.length; seat++) {
    const before = balance(svm, room.tokens[seat].wsol);
    await execute([await custody.claim(ledger, players[seat].publicKey, "wsol")], players[seat]);
    assert.equal(balance(svm, room.tokens[seat].wsol) - before, room.stake);
  }
  assert.equal(balance(svm, vaults(ledger).wsolVault), 0n);
  assert.equal(actions, 11);
});
