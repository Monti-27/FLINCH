import type { ChartInterval } from "./chart-options.ts";

export type Candle = { time: number; open: number; high: number; low: number; close: number; volume?: number; partial?: boolean };
export type Tick = { time: number; price: number; sequence: number; size?: number };
export const PRODUCT = "SOL-USD";
export const MAX_CANDLES = 360;
export const STALE_MS = 15_000;

function price(value: unknown): number {
  if (typeof value !== "string" && typeof value !== "number") throw new Error("Invalid market price");
  const raw = String(value);
  if (!/^\d{1,7}(\.\d{1,8})?$/.test(raw)) throw new Error("Invalid market precision");
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1_000_000) throw new Error("Invalid market price");
  return parsed;
}

function volume(value: unknown): number {
  if (typeof value !== "string" && typeof value !== "number") throw new Error("Invalid market volume");
  if (!/^\d{1,10}(\.\d{1,8})?$/.test(String(value))) throw new Error("Invalid market volume");
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1_000_000_000) throw new Error("Invalid market volume");
  return parsed;
}

export function parseHistory(value: unknown, now = Date.now()): Candle[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 400) throw new Error("Market history unavailable");
  const seen = new Map<number, Candle>();
  for (const row of value) {
    if (!Array.isArray(row) || row.length !== 6) throw new Error("Invalid candle data");
    const time: unknown = row[0];
    if (typeof time !== "number" || !Number.isSafeInteger(time) || time % 60 !== 0 || time * 1000 > now + 5000 || time * 1000 < now - 24 * 3600_000) throw new Error("Invalid candle time");
    const candle = { time, low: price(row[1]), high: price(row[2]), open: price(row[3]), close: price(row[4]), volume: volume(row[5]) };
    if (candle.low > Math.min(candle.open, candle.close) || candle.high < Math.max(candle.open, candle.close)) throw new Error("Invalid candle range");
    seen.set(time, candle);
  }
  return [...seen.values()].sort((a, b) => a.time - b.time).slice(-MAX_CANDLES);
}

export function parseTick(value: unknown, now = Date.now()): Tick | undefined {
  if (!value || typeof value !== "object") return;
  const row = value as Record<string, unknown>;
  if (row.type !== "ticker" || row.product_id !== PRODUCT) return;
  const time = typeof row.time === "string" ? Date.parse(row.time) : NaN;
  if (!Number.isFinite(time) || time > now + 5000 || now - time > STALE_MS) throw new Error("Market update is stale");
  if (typeof row.sequence !== "number" || !Number.isSafeInteger(row.sequence) || row.sequence < 0) throw new Error("Invalid market sequence");
  return { time, price: price(row.price), sequence: row.sequence, size: row.last_size === undefined ? undefined : volume(row.last_size) };
}

export function appendTick(candles: Candle[], tick: Tick): Candle[] {
  const time = Math.floor(tick.time / 60_000) * 60;
  const last = candles.at(-1);
  if (last && time < last.time) return candles;
  const candle: Candle = last?.time === time
    ? { ...last, close: tick.price, high: Math.max(last.high, tick.price), low: Math.min(last.low, tick.price) }
    : { time, open: tick.price, close: tick.price, high: tick.price, low: tick.price };
  candle.volume = last?.time === time && last.partial
    ? last.volume === undefined || tick.size === undefined ? undefined : last.volume + tick.size
    : tick.size;
  candle.partial = true;
  return [...(last?.time === time ? candles.slice(0, -1) : candles), candle].slice(-MAX_CANDLES);
}

export function aggregate(candles: Candle[], interval: ChartInterval): Candle[] {
  if (interval === 60) return candles;
  const result: Candle[] = [];
  for (const candle of candles) {
    const time = Math.floor(candle.time / interval) * interval;
    const last = result.at(-1);
    if (last?.time === time) {
      last.close = candle.close;
      last.high = Math.max(last.high, candle.high);
      last.low = Math.min(last.low, candle.low);
      if (last.volume !== undefined && candle.volume !== undefined) last.volume += candle.volume;
      else delete last.volume;
      if (candle.partial) last.partial = true;
    } else result.push({ ...candle, time });
  }
  return result;
}
