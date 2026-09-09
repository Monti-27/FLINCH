import { PublicKey } from "@solana/web3.js";
import type { BaseRoom, Control, FlinchClient } from "@flinch/client";

export type RoomView = {
  room?: BaseRoom; control?: Control; error?: string; observedAt: number; loading: boolean;
  controlNow?: bigint; controlObservedAt?: number; timerObservedAt?: number;
};

export async function readRoomView(client: Pick<FlinchClient, "readRoom" | "resolve">, address: string,
  previous: RoomView, signal: AbortSignal): Promise<RoomView> {
  let room = previous.room;
  let observedAt = previous.observedAt;
  let timerObservedAt = previous.timerObservedAt;
  try {
    signal.throwIfAborted();
    room = await client.readRoom(new PublicKey(address), room?.slot);
    signal.throwIfAborted();
    observedAt = Date.now();
    timerObservedAt = performance.now();
    if (room.control.kind !== "delegated") return { room, observedAt, timerObservedAt, loading: false };
    const er = await client.resolve(room, signal);
    signal.throwIfAborted();
    return { room, observedAt, timerObservedAt, control: er.control, controlNow: er.now, controlObservedAt: Date.now(), loading: false };
  } catch (error) {
    signal.throwIfAborted();
    return { room, observedAt, timerObservedAt, loading: false,
      error: error instanceof Error && error.name === "TimeoutError"
        ? "The network took too long to respond. Retrying automatically."
        : error instanceof Error ? error.message : "Cannot read room. Check your connection." };
  }
}
