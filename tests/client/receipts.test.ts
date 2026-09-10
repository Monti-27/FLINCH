import { test } from "node:test";
import assert from "node:assert/strict";
import { Keypair } from "@solana/web3.js";
import { readReceipts } from "../../packages/client/src/accounts/receipts.ts";
import { readBaseRoom } from "../../packages/client/src/accounts/read.ts";
import { roomFixture, fundAndStart, injectReturnedControlFixture, executeIx, receiptKey } from "../local/support/room.ts";
import { poolConnection } from "../local/support/quote.ts";
import { success, setTime } from "../local/support/runtime.ts";

test("confirmed receipt decoding binds identity, accounting totals and exact output", async () => {
  const room = await roomFixture();
  await fundAndStart(room);
  await injectReturnedControlFixture(room, 1);
  setTime(room.svm, 1002n);
  const receipt = receiptKey(room);
  success(room.svm, [await executeIx(room)], [room.players[0]]);
  const rpc = poolConnection(room);
  const state = await readBaseRoom(rpc, room.ledger);
  const receipts = await readReceipts(rpc, state);
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0].output, state.ledger.economics!.receivedUsdc);
  assert.equal(receipts[0].allocations[0], receipts[0].output);
  assert.equal(receipts[0].expired, false);
  await assert.rejects(readReceipts(rpc, { ...state, ledger: { ...state.ledger, economics: { ...state.ledger.economics!, receivedUsdc: 1n } } }), /totals/);
  const account = room.svm.getAccount(receipt)!;
  room.svm.setAccount(receipt, { ...account, owner: Keypair.generate().publicKey });
  await assert.rejects(readReceipts(rpc, state), /owner/);
});
