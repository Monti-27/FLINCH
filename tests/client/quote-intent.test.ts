import { test } from "node:test";
import assert from "node:assert/strict";
import { Connection, Keypair } from "@solana/web3.js";
import { prepareQuotedSell, submitQuotedSell } from "../../packages/client/src/quotes/intent.ts";
import { quoteSell } from "../../packages/client/src/quotes/sell.ts";
import { controlInstructions } from "../../packages/client/src/instructions/control.ts";
import { custodyInstructions } from "../../packages/client/src/instructions/custody.ts";
import { createProgram } from "../../packages/client/src/program.ts";
import { control, snapshot, signer } from "../keeper/fixtures.ts";

function fixture() {
  const room = snapshot();
  const current = { ...control(room), sellers: 0, attempts: [0, 0, 0, 0] as const, nonces: [0n, 0n, 0n, 0n] as const };
  const rpc = new Connection("http://127.0.0.1:17799");
  rpc.getLatestBlockhash = async () => ({ blockhash: Keypair.generate().publicKey.toBase58(), lastValidBlockHeight: 50 });
  const program = createProgram(rpc);
  const client = { readRoom: async () => room, resolve: async () => ({ connection: rpc, placement: { endpoint: rpc.rpcEndpoint,
    validator: room.ledger.validator, delegationSlot: 50 }, control: current, now: 101n, slot: 2 }),
    instructions: { ...custodyInstructions(program), ...controlInstructions(program) } };
  const quote = quoteSell({ pool: room.ledger.pool, slot: 50, chainTime: 101n, receivedAtMs: Date.now(), inputReserve: 100_000_000_000n,
    outputReserve: 20_000_000_000n, tradeFeeRate: 2500n, creatorFeeRate: 0n, fundFeeRate: 0n, protocolFeeRate: 0n, creatorFeeOnInput: true }, current, 0, 101n);
  return { client, quote, rpc, current };
}

test("quoted intent binds exact minima and rejects quote expiration during wallet signing", async context => {
  context.mock.timers.enable({ apis: ["Date"], now: 1000 });
  const { client, quote, rpc } = fixture();
  let sends = 0;
  rpc.sendRawTransaction = async () => { sends++; return "unexpected"; };
  await assert.rejects(prepareQuotedSell(client, quote, { ...signer, sign: async tx => {
    context.mock.timers.tick(2000);
    return signer.sign(tx);
  } }), /expired/);
  assert.equal(sends, 0);
});

test("a quote that expires during blockhash loading never prompts the signer", async context => {
  context.mock.timers.enable({ apis: ["Date"], now: 1000 });
  const { client, quote, rpc } = fixture();
  const blockhash = rpc.getLatestBlockhash.bind(rpc);
  rpc.getLatestBlockhash = async () => {
    context.mock.timers.tick(2000);
    return blockhash();
  };
  let prompts = 0;
  await assert.rejects(prepareQuotedSell(client, quote, { ...signer, sign: async tx => {
    prompts++;
    return signer.sign(tx);
  } }), /expired/);
  assert.equal(prompts, 0);
});

test("signed sell is revalidated before submission and never rerouted or repriced", async context => {
  context.mock.timers.enable({ apis: ["Date"], now: 1000 });
  const { client, quote, rpc } = fixture();
  const sell = await prepareQuotedSell(client, quote, signer);
  let sends = 0;
  rpc.sendRawTransaction = async () => { sends++; return sell.prepared.submission.signature; };
  assert.equal(await submitQuotedSell(client, sell), sell.prepared.submission.signature);
  assert.equal(sends, 1);
  context.mock.timers.tick(2000);
  await assert.rejects(submitQuotedSell(client, sell), /expired/);
  assert.equal(sends, 1);
});

test("quote rejects a substituted venue, unauthorized signer, changed placement and aborted operation", async () => {
  const { client, quote } = fixture();
  await assert.rejects(prepareQuotedSell(client, { ...quote, pool: Keypair.generate().publicKey }, signer), /venue/);
  await assert.rejects(prepareQuotedSell(client, quote, { ...signer, publicKey: Keypair.generate().publicKey }), /authorized/);
  const sell = await prepareQuotedSell(client, quote, signer);
  await assert.rejects(submitQuotedSell(client, { ...sell, endpoint: "http://127.0.0.1:17798" }), /placement/);
  await assert.rejects(prepareQuotedSell(client, quote, signer, { signal: AbortSignal.abort() }));
});
