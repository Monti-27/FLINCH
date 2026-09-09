import { afterEach, expect, it, vi } from "vitest";
import { createQuoteFeed } from "../src/features/match/quote-feed.ts";
import { ticketQuote } from "./room-ticket-data.ts";

afterEach(() => vi.useRealTimers());

const current = () => ({ ...ticketQuote, receivedAtMs: Date.now(), expiresAtMs: Date.now() + 2000 });

it("loads automatically and refreshes repeatedly before its two-second expiry without signing", async () => {
  vi.useFakeTimers();
  const read = vi.fn(async () => current());
  const feed = createQuoteFeed(read);
  feed.start();
  await feed.refresh();
  expect(read).toHaveBeenCalledTimes(1);
  const first = feed.store.getState().quote;
  await vi.advanceTimersByTimeAsync(5000);
  expect(read).toHaveBeenCalledTimes(6);
  expect(feed.store.getState().quote!.receivedAtMs).toBe(first!.receivedAtMs + 5000);
  expect(feed.store.getState()).toMatchObject({ failed: false, loading: false });
  feed.stop();
});

it("coalesces refresh clicks and keeps the last price visible while a read is pending", async () => {
  vi.useFakeTimers();
  let finish!: (quote: typeof ticketQuote) => void;
  const read = vi.fn(async () => current());
  const feed = createQuoteFeed(read);
  feed.start();
  await feed.refresh();
  const previous = feed.store.getState().quote;
  read.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const pending = feed.refresh();
  expect(feed.refresh()).toBe(pending);
  await Promise.resolve();
  expect(read).toHaveBeenCalledTimes(2);
  expect(feed.store.getState()).toMatchObject({ quote: previous, loading: true });
  finish(current());
  await pending;
  feed.stop();
});

it("backs off failed reads, recovers automatically and retains only observed prices", async () => {
  vi.useFakeTimers();
  const read = vi.fn(async () => current());
  const feed = createQuoteFeed(read);
  feed.start();
  await feed.refresh();
  const previous = feed.store.getState().quote;
  read.mockRejectedValue(new Error("RPC unavailable"));
  await vi.advanceTimersByTimeAsync(4000);
  expect(read).toHaveBeenCalledTimes(4);
  expect(feed.store.getState()).toMatchObject({ quote: previous, failed: true, loading: false });
  read.mockImplementation(async () => current());
  await vi.advanceTimersByTimeAsync(4000);
  expect(feed.store.getState().failed).toBe(false);
  feed.stop();
});

it("aborts on pause, ignores late results and immediately refreshes on resume", async () => {
  vi.useFakeTimers();
  let finish!: (quote: typeof ticketQuote) => void;
  const read = vi.fn((_signal: AbortSignal) => new Promise<typeof ticketQuote>(resolve => { finish = resolve; }));
  const feed = createQuoteFeed(read);
  feed.start();
  const pending = feed.refresh();
  await Promise.resolve();
  feed.stop();
  expect(read.mock.calls[0][0].aborted).toBe(true);
  finish(current());
  await pending;
  await vi.advanceTimersByTimeAsync(10_000);
  expect(read).toHaveBeenCalledTimes(1);
  expect(feed.store.getState().quote).toBeUndefined();
  read.mockImplementation(async () => current());
  feed.start();
  await feed.refresh();
  expect(read).toHaveBeenCalledTimes(2);
  expect(feed.store.getState().paused).toBe(false);
  feed.stop();
});

it("does not publish a response that already expired or belongs to a stopped request", async () => {
  vi.useFakeTimers();
  const read = vi.fn(async () => ({ ...current(), expiresAtMs: Date.now() }));
  const feed = createQuoteFeed(read);
  feed.start();
  await feed.refresh();
  expect(feed.store.getState().failed).toBe(true);
  expect(feed.store.getState().quote).toBeUndefined();
  feed.stop();
  await feed.refresh();
  expect(read).toHaveBeenCalledTimes(1);
});
