import { test } from "node:test";
import assert from "node:assert/strict";
import { setTimeout } from "node:timers/promises";
import { runRooms } from "../../apps/keeper/src/scheduler.ts";
import { key } from "./fixtures.ts";

test("scheduler deduplicates rooms and bounds concurrent work", async () => {
  const abort = new AbortController();
  const rooms = Array.from({ length: 8 }, key);
  const counts = new Map<string, number>();
  let active = 0;
  let peak = 0;
  let completed = 0;
  await runRooms({ tick: async room => {
    const id = room.toBase58();
    counts.set(id, (counts.get(id) ?? 0) + 1);
    peak = Math.max(peak, ++active);
    await setTimeout(5);
    active--;
    if (++completed === rooms.length) abort.abort();
    return { room: id, kind: "wait" };
  } }, [...rooms, ...rooms], abort.signal, () => assert.fail("unexpected worker failure"), 3);
  assert.equal(peak, 3);
  assert.equal(active, 0);
  assert.equal(counts.size, 8);
  assert([...counts.values()].every(count => count === 1));
});

test("scheduler backs off failures and aborts while waiting", async () => {
  const abort = new AbortController();
  let errors = 0;
  const times: number[] = [];
  await runRooms({ tick: async () => { times.push(Date.now()); throw new Error("RPC unavailable"); } }, [key()], abort.signal,
    () => { if (++errors === 2) abort.abort(); });
  assert(times[1] - times[0] >= 490);
  assert.equal(errors, 2);
  const idle = new AbortController();
  const run = runRooms({ tick: async () => assert.fail("empty queue") }, [], idle.signal, () => undefined);
  idle.abort();
  await run;
});

test("invalid scheduler bounds reject and fatal reporting errors drain in-flight work", async () => {
  const abort = new AbortController();
  let active = 0;
  await assert.rejects(runRooms({ tick: async () => assert.fail() }, [], abort.signal, () => undefined, 5));
  let count = 0;
  await assert.rejects(runRooms({ tick: async room => {
    if (++count === 1) throw new Error("failure");
    active++;
    await setTimeout(5);
    active--;
    return { room: room.toBase58(), kind: "wait" };
  } }, [key(), key(), key()], abort.signal, () => { throw new Error("reporter failure"); }, 2), /reporter failure/);
  assert.equal(active, 0);
});
