import { test } from "node:test";
import assert from "node:assert/strict";
import { Connection } from "@solana/web3.js";
import { readSellContext, observationTime } from "../../packages/client/src/quotes/context.ts";
import { control, snapshot } from "../keeper/fixtures.ts";

test("reads pool before the verified ER Clock so a slow pool response cannot age the cohort", async context => {
  context.mock.timers.enable({ apis: ["Date"], now: 100_000 });
  const room = snapshot();
  const events: string[] = [];
  const client = {
    readRoom: async () => { events.push("room"); return room; },
    resolve: async () => {
      events.push("resolve");
      return { connection: new Connection("http://127.0.0.1:17799"),
        placement: { endpoint: "http://127.0.0.1:17799", validator: room.ledger.validator, delegationSlot: 50 },
        control: { ...control(room), sellers: 0 }, now: BigInt(Math.floor(Date.now() / 1000)), slot: 50 };
    },
  };
  const observation = await readSellContext(client, async (pool, slot) => {
    assert(pool.equals(room.ledger.pool));
    assert.equal(slot, room.slot);
    events.push("pool");
    context.mock.timers.tick(3000);
    return { pool, slot: 50, chainTime: 103n, receivedAtMs: Date.now(), inputReserve: 100_000_000_000n,
      outputReserve: 20_000_000_000n, tradeFeeRate: 2500n, creatorFeeRate: 0n, fundFeeRate: 0n,
      protocolFeeRate: 0n, creatorFeeOnInput: true };
  }, room.ledger.address, 0, 100);
  assert.deepEqual(events, ["room", "pool", "resolve"]);
  assert.equal(observation.quote.cohortIndex, 1);
  assert.equal(observation.er.now, 103n);
  assert.equal(observation.observedAtMs, 103_000);
});

test("Clock projection counts elapsed read time without accepting old or backwards observations", () => {
  assert.equal(observationTime(101n, 1000, 1999), 101n);
  assert.equal(observationTime(101n, 1000, 2000), 102n);
  assert.throws(() => observationTime(101n, 1000, 3000), /expired/);
  assert.throws(() => observationTime(101n, 1000, 999), /expired/);
});
