import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createMarketStore } from "../src/features/market/store.ts";
import { connectMarket } from "../src/features/market/stream.ts";

class Socket {
  static instances: Socket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  sent: string[] = [];
  closed = false;
  constructor() { Socket.instances.push(this); }
  send(value: string) { this.sent.push(value); }
  close() { this.closed = true; this.onclose?.(); }
  message(value: unknown) { this.onmessage?.({ data: JSON.stringify(value) }); }
}

let page: EventTarget & { hidden: boolean };
let win: EventTarget;
let cleanup: (() => void) | undefined;
const now = 1_788_640_810_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  Socket.instances = [];
  page = Object.assign(new EventTarget(), { hidden: false });
  win = new EventTarget();
  vi.stubGlobal("document", page);
  vi.stubGlobal("window", win);
  vi.stubGlobal("navigator", { onLine: true });
  vi.stubGlobal("WebSocket", Socket);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [[Math.floor(now / 60_000) * 60, 99, 102, 100, 101, 12]] }));
});

afterEach(() => { cleanup?.(); cleanup = undefined; vi.useRealTimers(); vi.unstubAllGlobals(); });

it("subscribes to the fixed public product and cleans up its connection", async () => {
  const store = createMarketStore();
  cleanup = connectMarket(store);
  await vi.advanceTimersByTimeAsync(0);
  const socket = Socket.instances[0];
  socket.onopen?.();
  expect(JSON.parse(socket.sent[0])).toEqual({ type: "subscribe", product_ids: ["SOL-USD"], channels: ["ticker", "heartbeat"] });
  socket.message({ type: "ticker", product_id: "SOL-USD", price: "101.2", sequence: 1, time: new Date(now).toISOString() });
  expect(store.getState().status).toBe("live");
  cleanup(); cleanup = undefined;
  expect(socket.closed).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});

it("reconnects with history and ignores callbacks from old connections", async () => {
  const store = createMarketStore();
  cleanup = connectMarket(store);
  await vi.advanceTimersByTimeAsync(0);
  const first = Socket.instances[0];
  first.close();
  expect(store.getState().status).toBe("offline");
  await vi.advanceTimersByTimeAsync(1000);
  expect(Socket.instances).toHaveLength(2);
  first.message({ type: "ticker", product_id: "SOL-USD", price: "999", sequence: 1, time: new Date(now).toISOString() });
  expect(store.getState().tick).toBeUndefined();
});

it("pauses hidden tabs and reconnects on return", async () => {
  cleanup = connectMarket(createMarketStore());
  await vi.advanceTimersByTimeAsync(0);
  page.hidden = true;
  page.dispatchEvent(new Event("visibilitychange"));
  expect(Socket.instances[0].closed).toBe(true);
  await vi.advanceTimersByTimeAsync(30_000);
  expect(Socket.instances).toHaveLength(1);
  page.hidden = false;
  page.dispatchEvent(new Event("visibilitychange"));
  await vi.advanceTimersByTimeAsync(0);
  expect(Socket.instances).toHaveLength(2);
});

it("keeps failed history explicit and retries without constructing fake prices", async () => {
  vi.mocked(fetch).mockRejectedValue(new Error("Unavailable"));
  const store = createMarketStore();
  cleanup = connectMarket(store);
  await vi.advanceTimersByTimeAsync(0);
  expect(store.getState()).toMatchObject({ status: "offline", candles: [] });
  expect(Socket.instances).toHaveLength(0);
  await vi.advanceTimersByTimeAsync(1000);
  expect(fetch).toHaveBeenCalledTimes(2);
});
