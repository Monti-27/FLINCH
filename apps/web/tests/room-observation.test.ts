import { afterEach, expect, it, vi } from "vitest";
import { Connection } from "@solana/web3.js";
import type { BaseRoom, FlinchClient } from "@flinch/client";
import { readRoomView } from "../src/features/match/room-observation.ts";
import type { RoomView } from "../src/features/match/room-observation.ts";
import { control, snapshot } from "../../../tests/keeper/fixtures.ts";

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

function fixture() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(1000);
  vi.spyOn(performance, "now").mockReturnValue(200);
  const room = snapshot();
  const current = control(room);
  const previous: RoomView = { room, control: current, observedAt: 500, timerObservedAt: 100, controlNow: 101n, controlObservedAt: 600, loading: false };
  const client = {
    readRoom: vi.fn(async () => room),
    resolve: vi.fn(async () => ({ connection: new Connection("http://127.0.0.1:17799"),
      placement: { endpoint: "http://127.0.0.1:17799", validator: room.ledger.validator, delegationSlot: 1 },
      control: current, now: 102n, slot: 50 })),
  } satisfies Pick<FlinchClient, "readRoom" | "resolve">;
  return { room, current, previous, client, signal: new AbortController().signal };
}

it("retains the last confirmed balances and their original age after a base read failure", async () => {
  const f = fixture();
  f.client.readRoom.mockRejectedValue(new Error("Base RPC offline"));
  const view = await readRoomView(f.client, f.room.ledger.address.toBase58(), f.previous, f.signal);
  expect(view.room).toBe(f.room);
  expect(view.observedAt).toBe(500);
  expect(view.timerObservedAt).toBe(100);
  expect(view.control).toBeUndefined();
  expect(view.controlNow).toBeUndefined();
  expect(view.loading).toBe(false);
  expect(view.error).toBe("Base RPC offline");
  expect(f.client.resolve).not.toHaveBeenCalled();
});

it("keeps fresh Solana claims visible when the ER fails without making base reads look newer", async () => {
  const f = fixture();
  const room = { ...f.room, slot: 51, now: 103n };
  f.client.readRoom.mockResolvedValue(room);
  f.client.resolve.mockImplementation(async () => { vi.setSystemTime(4500); throw new Error("ER offline"); });
  const view = await readRoomView(f.client, room.ledger.address.toBase58(), f.previous, f.signal);
  expect(view.room).toBe(room);
  expect(view.observedAt).toBe(1000);
  expect(view.error).toBe("ER offline");
  expect(view.control).toBeUndefined();
  expect(f.client.readRoom).toHaveBeenCalledWith(room.ledger.address, 50);
});

it("records base and ER observations independently", async () => {
  const f = fixture();
  const resolved = await f.client.resolve();
  f.client.resolve.mockImplementation(async () => { vi.setSystemTime(1400); vi.mocked(performance.now).mockReturnValue(600); return resolved; });
  const view = await readRoomView(f.client, f.room.ledger.address.toBase58(), f.previous, f.signal);
  expect(view.observedAt).toBe(1000);
  expect(view.timerObservedAt).toBe(200);
  expect(view.controlObservedAt).toBe(1400);
  expect(view.controlNow).toBe(102n);
  expect(view.error).toBeUndefined();
});

it("does not resolve an ER for returned control or independent recovery", async () => {
  const f = fixture();
  const room: BaseRoom = { ...f.room, control: { kind: "not_required" } };
  f.client.readRoom.mockResolvedValue(room);
  const view = await readRoomView(f.client, room.ledger.address.toBase58(), f.previous, f.signal);
  expect(view.room).toBe(room);
  expect(view.control).toBeUndefined();
  expect(f.client.resolve).not.toHaveBeenCalled();
});

it("recovers from a temporary failure without keeping an old error", async () => {
  const f = fixture();
  const view = await readRoomView(f.client, f.room.ledger.address.toBase58(), { ...f.previous, error: "Offline" }, f.signal);
  expect(view.control).toBe(f.current);
  expect(view.error).toBeUndefined();
});

it("never publishes a cancelled room read", async () => {
  const f = fixture();
  const abort = new AbortController();
  f.client.readRoom.mockImplementation(async () => { abort.abort(); return f.room; });
  await expect(readRoomView(f.client, f.room.ledger.address.toBase58(), f.previous, abort.signal)).rejects.toThrow();
  expect(f.client.resolve).not.toHaveBeenCalled();
});

it("initial failures remain empty instead of inventing a room", async () => {
  const f = fixture();
  f.client.readRoom.mockRejectedValue(new Error("Room missing"));
  const view = await readRoomView(f.client, f.room.ledger.address.toBase58(), { loading: true, observedAt: 0 }, f.signal);
  expect(view.room).toBeUndefined();
  expect(view.observedAt).toBe(0);
  expect(view.loading).toBe(false);
});

it("explains an initial timeout and clears the message when the next read succeeds", async () => {
  const f = fixture();
  f.client.readRoom.mockRejectedValueOnce(new DOMException("Signal timed out", "TimeoutError"));
  const failed = await readRoomView(f.client, f.room.ledger.address.toBase58(), { loading: true, observedAt: 0 }, f.signal);
  expect(failed.error).toBe("The network took too long to respond. Retrying automatically.");
  expect(failed.room).toBeUndefined();
  expect(failed.observedAt).toBe(0);
  expect(failed.loading).toBe(false);
  const recovered = await readRoomView(f.client, f.room.ledger.address.toBase58(), failed, f.signal);
  expect(recovered.room).toBe(f.room);
  expect(recovered.control).toBe(f.current);
  expect(recovered.error).toBeUndefined();
});

it("a timed-out refresh retains confirmed balances without retaining stale ER control", async () => {
  const f = fixture();
  f.client.readRoom.mockRejectedValueOnce(new DOMException("Signal timed out", "TimeoutError"));
  const view = await readRoomView(f.client, f.room.ledger.address.toBase58(), f.previous, f.signal);
  expect(view.error).toBe("The network took too long to respond. Retrying automatically.");
  expect(view.room).toBe(f.room);
  expect(view.observedAt).toBe(500);
  expect(view.control).toBeUndefined();
  expect(view.controlNow).toBeUndefined();
  expect(view.controlObservedAt).toBeUndefined();
});

it("does not report a timeout as a retry when the room read was cancelled", async () => {
  const f = fixture();
  const abort = new AbortController();
  f.client.readRoom.mockImplementation(async () => {
    abort.abort();
    throw new DOMException("Signal timed out", "TimeoutError");
  });
  await expect(readRoomView(f.client, f.room.ledger.address.toBase58(), f.previous, abort.signal)).rejects.toMatchObject({ name: "AbortError" });
  expect(f.client.resolve).not.toHaveBeenCalled();
});
