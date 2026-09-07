import type { PublicKey } from "@solana/web3.js";
import type { RoomWorker, WorkerEvent } from "./room-worker.ts";

export async function runRooms(worker: Pick<RoomWorker, "tick">, rooms: PublicKey[] | (() => PublicKey[]), signal: AbortSignal,
  onError: (room: string, error: unknown) => void, concurrency = 4) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) throw new Error("Invalid worker bounds");
  const backoff = new Map<string, { failures: number; due: number }>();
  let fatal: { error: unknown } | undefined;
  while (!signal.aborted) {
    const current = typeof rooms === "function" ? rooms() : rooms;
    if (current.length > 128) throw new Error("Invalid worker bounds");
    const unique = [...new Map(current.map(room => [room.toBase58(), room])).values()];
    const present = new Set(unique.map(room => room.toBase58()));
    for (const key of backoff.keys()) if (!present.has(key)) backoff.delete(key);
    const queue = unique.filter(room => (backoff.get(room.toBase58())?.due ?? 0) <= Date.now());
    await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      for (let room = queue.shift(); room && !signal.aborted && !fatal; room = queue.shift()) {
        const key = room.toBase58();
        try {
          const event: WorkerEvent = await worker.tick(room, signal);
          backoff.set(key, { failures: 0, due: Date.now() + (event.kind === "done" ? 4000 : 250) });
        } catch (error) {
          if (signal.aborted) break;
          const failures = Math.min((backoff.get(key)?.failures ?? 0) + 1, 4);
          backoff.set(key, { failures, due: Date.now() + Math.min(4000, 250 * 2 ** failures) });
          try { onError(key, error); } catch (callbackError) { fatal = { error: callbackError }; }
        }
      }
    }));
    if (fatal) throw fatal.error;
    if (!signal.aborted) await new Promise<void>(resolve => {
      const done = () => { clearTimeout(timer); signal.removeEventListener("abort", done); resolve(); };
      const timer = setTimeout(done, 250);
      signal.addEventListener("abort", done, { once: true });
      if (signal.aborted) done();
    });
  }
}
