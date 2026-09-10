import { describe, expect, it } from "vitest";
import { aggregate, appendTick, MAX_CANDLES, parseHistory, parseTick, STALE_MS } from "../src/features/market/model.ts";
import { createMarketStore } from "../src/features/market/store.ts";

const minute = Math.floor(Date.now() / 60_000) * 60;
const now = minute * 1000 + 10_000;
const raw = (time = minute) => [time, 99, 102, 100, 101, 12];
const tick = (time = now, sequence = 1, price = "101.20") => ({ type: "ticker", product_id: "SOL-USD", time: new Date(time).toISOString(), sequence, price });

describe("market boundary", () => {
  it("sorts and deduplicates history without filling missing candles", () => {
    expect(parseHistory([raw(), raw(minute - 180), raw()], now).map(c => c.time)).toEqual([minute - 180, minute]);
  });
  it.each([[], [[minute, 99]], [raw(minute + 60)], [[minute, 103, 102, 100, 101, 12]], [[minute, 99, Infinity, 100, 101, 12]]].map(value => ({ value })))("rejects malformed history %#", ({ value }) => {
    expect(() => parseHistory(value, now)).toThrow();
  });
  it("rejects invalid price ranges, precision and stale timestamps", () => {
    for (const value of ["0", "-1", "NaN", "1000001", "1e3", "1.123456789"]) expect(() => parseTick(tick(now, 1, value), now)).toThrow();
    expect(() => parseTick(tick(now - STALE_MS - 1), now)).toThrow();
    expect(() => parseTick(tick(now + 5001), now)).toThrow();
  });
  it("ignores unrelated products and message types", () => {
    expect(parseTick({ ...tick(), product_id: "BTC-USD" }, now)).toBeUndefined();
    expect(parseTick({ type: "heartbeat" }, now)).toBeUndefined();
  });
  it("rejects unsafe sequence values", () => {
    expect(() => parseTick(tick(now, Number.MAX_SAFE_INTEGER + 1), now)).toThrow();
  });
  it("aggregates five-minute OHLC without mutating input", () => {
    const base = Math.floor(minute / 300) * 300;
    const candles = [{ time: base, open: 10, close: 11, high: 12, low: 9 }, { time: base + 60, open: 11, close: 13, high: 14, low: 10 }];
    const before = structuredClone(candles);
    expect(aggregate(candles, 300)).toEqual([{ time: base, open: 10, close: 13, high: 14, low: 9 }]);
    expect(candles).toEqual(before);
  });
  it("bounds history and ignores ticks before the latest candle", () => {
    let candles = parseHistory([raw()], now);
    for (let index = 0; index < MAX_CANDLES + 10; index++) candles = appendTick(candles, { time: now + index * 60_000, price: 100, sequence: index });
    expect(candles).toHaveLength(MAX_CANDLES);
    expect(appendTick(candles, { time: now - 60_000, price: 50, sequence: 999 })).toBe(candles);
  });
});

describe("market store", () => {
  it("isolates providers and rejects replayed and out-of-order ticks", () => {
    const a = createMarketStore();
    const b = createMarketStore();
    const first = parseTick(tick(), now)!;
    a.getState().accept(first);
    a.getState().accept({ ...first, price: 200 });
    a.getState().accept({ ...first, time: now - 1, sequence: 2, price: 200 });
    expect(a.getState().tick).toEqual(first);
    expect(b.getState().candles).toEqual([]);
  });
  it("retains last observations with explicit stale status", () => {
    const store = createMarketStore();
    store.getState().accept(parseTick(tick(), now)!);
    store.getState().checkFreshness(now + STALE_MS + 1);
    expect(store.getState().status).toBe("stale");
    expect(store.getState().tick?.price).toBe(101.2);
    store.getState().accept(parseTick(tick(now + 20_000, 2), now + 20_000)!);
    expect(store.getState().status).toBe("live");
  });
});
