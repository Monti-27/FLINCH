import { discoverRooms } from "@flinch/client";
import type { FlinchClient, RoomDiscovery } from "@flinch/client";
import type { PublicKey } from "@solana/web3.js";
import type { OperationStore } from "../store.ts";
import { decide } from "../decision.ts";

export class RoomCatalog {
  private readonly active = new Map<string, PublicKey>();
  private due = 0;
  private checking: Promise<void> | undefined;
  private stopped = false;
  private fatal: { error: unknown } | undefined;
  private readonly pinned: Set<string>;

  constructor(rooms: readonly PublicKey[], privateClient: Pick<FlinchClient, "base" | "readRoom" | "config" | "programId">, scope: RoomDiscovery,
    store: OperationStore, onError: (error: unknown) => void,
    options: { discover?: typeof discoverRooms; pinned?: readonly PublicKey[] } = {}) {
    if (rooms.length > 128) throw new Error("Too many rooms to resume safely");
    this.pinned = new Set((options.pinned ?? rooms).map(room => room.toBase58()));
    rooms.forEach(room => this.active.set(room.toBase58(), room));
    this.refresh = async () => {
      const discovered = await (options.discover ?? discoverRooms)(privateClient.base, scope, privateClient.programId);
      for (const address of discovered) {
        if (this.stopped) break;
        if (this.active.has(address.toBase58())) continue;
        if (this.active.size >= 128) throw new Error("Room discovery capacity reached; known rooms continue running");
        const prior = await store.get(address.toBase58());
        if (prior && prior.genesis !== privateClient.config.expectedGenesis) throw new Error("Discovery journal belongs to another chain");
        const room = await privateClient.readRoom(address, prior ? Math.max(prior.observedSlot, prior.runtime === "base" ? prior.confirmationSlot ?? 0 : 0) : undefined);
        if (!room.ledger.pool.equals(scope.pool) || !room.ledger.validator.equals(scope.validator)) throw new Error("Discovered room scope changed");
        if (decide(room).kind === "done" && prior?.status !== "pending") continue;
        this.active.set(address.toBase58(), address);
      }
    };
    this.onError = onError;
  }

  private readonly refresh: () => Promise<void>;
  private readonly onError: (error: unknown) => void;

  rooms = () => {
    if (this.fatal) throw this.fatal.error;
    if (!this.stopped && !this.checking && Date.now() >= this.due) {
      this.due = Date.now() + 2000;
      this.checking = this.refresh().catch(error => {
        this.due = Date.now() + 5000;
        try { this.onError(error); } catch (reporterError) { this.fatal = { error: reporterError }; }
      }).finally(() => { this.checking = undefined; });
    }
    return [...this.active.values()];
  };

  complete(room: string) { if (!this.pinned.has(room)) this.active.delete(room); }
  async stop() { this.stopped = true; await this.checking; }
}
