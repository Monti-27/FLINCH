import { test } from "node:test";
import assert from "node:assert/strict";
import { Connection, Keypair } from "@solana/web3.js";
import { prepareQuotedSell, submitQuotedSell, SellNotSubmittedError } from "../../packages/client/src/quotes/intent.ts";
import { refreshSellQuote } from "../../packages/client/src/quotes/refresh.ts";
import { quoteSell } from "../../packages/client/src/quotes/sell.ts";
import type { SellQuote } from "../../packages/client/src/quotes/sell.ts";
import { controlInstructions } from "../../packages/client/src/instructions/control.ts";
import { createProgram } from "../../packages/client/src/program.ts";
import { control, snapshot, signer } from "../keeper/fixtures.ts";

function fixture() {
  const room = snapshot();
  const current = { ...control(room), sellers: 0 };
  const rpc = new Connection("http://127.0.0.1:17799");
  rpc.getLatestBlockhash = async () => ({ blockhash: Keypair.generate().publicKey.toBase58(), lastValidBlockHeight: 50 });
  let now = 101n;
  let reserve = 20_000_000_000n;
  let quotes = 0;
  const read = () => quoteSell({ pool: room.ledger.pool, slot: 50, chainTime: now, receivedAtMs: Date.now(),
    inputReserve: 100_000_000_000n, outputReserve: reserve, tradeFeeRate: 2500n, creatorFeeRate: 0n,
    fundFeeRate: 0n, protocolFeeRate: 0n, creatorFeeOnInput: true }, current, 0, now);
  const client = { readRoom: async () => room, resolve: async () => ({ connection: rpc, placement: { endpoint: rpc.rpcEndpoint,
    validator: room.ledger.validator, delegationSlot: 50 }, control: current, now, slot: 50 }),
    quote: async () => { quotes++; return read(); }, instructions: controlInstructions(createProgram(rpc)) };
  const quote = read();
  return { client, quote, rpc, current, quotes: () => quotes, setTime: (time: bigint) => { now = time; },
    setReserve: (value: bigint) => { reserve = value; } };
}

test("refreshes an expired displayed quote before approval without reducing the reviewed minimum", async context => {
  context.mock.timers.enable({ apis: ["Date"], now: 1000 });
  const f = fixture();
  context.mock.timers.tick(5000);
  f.setTime(106n);
  f.setReserve(19_900_000_000n);
  let prompts = 0;
  const sell = await prepareQuotedSell(f.client, f.quote, { ...signer, sign: tx => { prompts++; return signer.sign(tx); } }, { refreshQuote: true });
  assert.equal(sell.quote.minimumOutput, f.quote.minimumOutput);
  assert.equal(sell.quote.cohortIndex, 3);
  assert.equal(f.quotes(), 1);
  assert.equal(prompts, 1);
});

test("rechecks price after a slow wallet approval and submits the exact signed bytes once", async context => {
  context.mock.timers.enable({ apis: ["Date"], now: 1000 });
  const f = fixture();
  let prompts = 0;
  const sell = await prepareQuotedSell(f.client, f.quote, { ...signer, sign: tx => {
    prompts++;
    context.mock.timers.tick(7000);
    f.setTime(108n);
    return signer.sign(tx);
  } }, { refreshQuote: true });
  let sends = 0;
  f.rpc.sendRawTransaction = async bytes => {
    sends++;
    assert.deepEqual(Buffer.from(bytes), Buffer.from(sell.prepared.transaction.serialize()));
    return sell.prepared.submission.signature;
  };
  assert.equal(await submitQuotedSell(f.client, sell), sell.prepared.submission.signature);
  assert.equal(prompts, 1);
  assert.equal(sends, 1);
  assert.equal(f.quotes(), 2);
  assert.equal(sell.quote.minimumOutput, f.quote.minimumOutput);
});

test("a moved price after signing stops before broadcast with the original minimum unchanged", async context => {
  context.mock.timers.enable({ apis: ["Date"], now: 1000 });
  const f = fixture();
  const sell = await prepareQuotedSell(f.client, f.quote, signer, { refreshQuote: true });
  f.setReserve(10_000_000_000n);
  let sends = 0;
  f.rpc.sendRawTransaction = async () => { sends++; return "unexpected"; };
  await assert.rejects(submitQuotedSell(f.client, sell), error => error instanceof SellNotSubmittedError && /approved minimum/.test(error.message));
  assert.equal(sends, 0);
  assert.equal(sell.quote.minimumOutput, f.quote.minimumOutput);
});

test("only unsigned timing races are retried and a cancelled approval never re-prompts", async context => {
  context.mock.timers.enable({ apis: ["Date"], now: 1000 });
  const f = fixture();
  const blockhash = f.rpc.getLatestBlockhash.bind(f.rpc);
  let reads = 0;
  f.rpc.getLatestBlockhash = async () => {
    if (++reads === 1) context.mock.timers.tick(2000);
    return blockhash();
  };
  let prompts = 0;
  await assert.rejects(prepareQuotedSell(f.client, f.quote, { ...signer, sign: async () => {
    prompts++;
    throw Object.assign(new Error("User rejected the request"), { code: 4001 });
  } }, { refreshQuote: true }), /rejected/);
  assert.equal(f.quotes(), 2);
  assert.equal(prompts, 1);
});

test("timing retries are bounded and never produce a signature while each read is stale", async context => {
  context.mock.timers.enable({ apis: ["Date"], now: 1000 });
  const f = fixture();
  const blockhash = f.rpc.getLatestBlockhash.bind(f.rpc);
  f.rpc.getLatestBlockhash = async () => { context.mock.timers.tick(2000); return blockhash(); };
  let prompts = 0;
  await assert.rejects(prepareQuotedSell(f.client, f.quote, { ...signer, sign: tx => { prompts++; return signer.sign(tx); } }, { refreshQuote: true }), /expired/);
  assert.equal(f.quotes(), 3);
  assert.equal(prompts, 0);
});

test("refresh never changes position, nonce, venue, holdings, seller set, slippage or moves backwards", async () => {
  const f = fixture();
  const changed: Partial<SellQuote>[] = [
    { ledger: Keypair.generate().publicKey }, { pool: Keypair.generate().publicKey }, { seat: 1 },
    { revision: 9n }, { nonce: f.quote.nonce + 1n }, { sellers: 2 }, { holdings: [1n, 2n, 3n, 4n] },
    { slippageBps: 200 }, { poolSlot: 49 }, { cohortIndex: -1 },
  ];
  for (const change of changed) {
    await assert.rejects(refreshSellQuote({ quote: async () => ({ ...f.quote, ...change }) }, f.quote));
  }
  await assert.rejects(refreshSellQuote(f.client, f.quote, AbortSignal.abort()));
});

test("automatic refresh still rejects route changes, round end and unavailable reads before sending", async context => {
  context.mock.timers.enable({ apis: ["Date"], now: 1000 });
  const f = fixture();
  const sell = await prepareQuotedSell(f.client, f.quote, signer, { refreshQuote: true });
  let sends = 0;
  f.rpc.sendRawTransaction = async () => { sends++; return "unexpected"; };
  await assert.rejects(submitQuotedSell(f.client, { ...sell, endpoint: "http://127.0.0.1:17798" }), /placement/);
  f.setTime(190n);
  await assert.rejects(submitQuotedSell(f.client, sell), /not accepting/);
  f.client.quote = async () => { throw new Error("RPC offline"); };
  await assert.rejects(submitQuotedSell(f.client, sell), error => error instanceof SellNotSubmittedError && /offline/.test(error.message));
  assert.equal(sends, 0);
});
