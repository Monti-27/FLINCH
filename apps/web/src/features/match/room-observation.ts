import { PublicKey } from "@solana/web3.js";
import type { BaseRoom, Control, FlinchClient } from "@flinch/client";

export type RoomView = {
  room?: BaseRoom; control?: Control; error?: string; observedAt: number; loading: boolean;
  controlNow?: bigint; controlObservedAt?: number;
};

export async function readRoomView(client: Pick<FlinchClient, "readRoom" | "resolve">, address: string,
  previous: RoomView, signal: AbortSignal): Promise<RoomView> {
  let room = previous.room;
  let observedAt = previous.observedAt;
  try {
    signal.throwIfAborted();
    room = await client.readRoom(new PublicKey(address), room?.slot);
    signal.throwIfAborted();
    observedAt = Date.now();
    if (room.control.kind !== "delegated") return { room, observedAt, loading: false };
    const er = await client.resolve(room, signal);
    signal.throwIfAborted();
    return { room, observedAt, control: er.control, controlNow: er.now, controlObservedAt: Date.now(), loading: false };
  } catch (error) {
    signal.throwIfAborted();
    return { room, observedAt, loading: false,
      error: error instanceof Error ? error.message : "Cannot read room. Check your connection." };
  }
}
