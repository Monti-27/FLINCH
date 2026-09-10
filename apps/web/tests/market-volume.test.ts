import { expect, it } from "vitest";
import { aggregate, appendTick, parseHistory, parseTick } from "../src/features/market/model.ts";
import { createMarketStore } from "../src/features/market/store.ts";

const now = 1_788_640_810_000;
const minute = Math.floor(now / 60_000) * 60;
const raw = [minute, 99, 102, 100, 101, 12];

it("retains actual historical volume and rejects invalid quantities", () => {
  expect(parseHistory([raw], now)[0].volume).toBe(12);
  for (const volume of [-1, Infinity, "NaN", "1e3", "0.000000001", 1_000_000_001, null]) {
    expect(() => parseHistory([[...raw.slice(0, 5), volume]], now)).toThrow("volume");
  }
  expect(parseHistory([[...raw.slice(0, 5), 0]], now)[0].volume).toBe(0);
});

it("does not double count overlapping historical and live volume", () => {
  const store = createMarketStore();
  store.getState().replaceHistory(parseHistory([raw], now));
  store.getState().accept({ time: now, sequence: 1, price: 102, size: 2 });
  store.getState().accept({ time: now + 1, sequence: 2, price: 103, size: 3 });
  store.getState().accept({ time: now + 1, sequence: 2, price: 103, size: 3 });
  expect(store.getState().candles[0]).toMatchObject({ volume: 5, partial: true, open: 100, high: 103 });
});

it("keeps unknown trade size unknown for the entire candle", () => {
  let candles = appendTick([], { time: now, sequence: 1, price: 100 });
  candles = appendTick(candles, { time: now + 1, sequence: 2, price: 101, size: 5 });
  expect(candles[0].volume).toBeUndefined();
  expect(aggregate(candles, 300)[0].volume).toBeUndefined();
});

it("accepts actual ticker sizes without requiring or inventing them", () => {
  const tick = { type: "ticker", product_id: "SOL-USD", time: new Date(now).toISOString(), sequence: 1, price: "100" };
  expect(parseTick({ ...tick, last_size: "0.00000001" }, now)?.size).toBe(0.00000001);
  expect(parseTick(tick, now)?.size).toBeUndefined();
  expect(() => parseTick({ ...tick, last_size: "-1" }, now)).toThrow();
});
