import { FlinchClient, LocalPlacementResolver, connection, verifyNetwork, discoverRooms } from "@flinch/client";
import type { KeeperConfig } from "./config.ts";
import { errorCode, KeeperError } from "./errors.ts";
import { acquireJournal } from "./lease.ts";
import { loadSigner } from "./signer.ts";
import { FileOperationStore } from "../file-store.ts";
import { RoomWorker } from "../room-worker.ts";
import { runRooms } from "../scheduler.ts";
import { decide } from "../decision.ts";
import { RoomCatalog } from "./discovery.ts";
import type { OperationStore } from "../store.ts";
import type { PublicKey } from "@solana/web3.js";

export type RuntimeEvent = Readonly<{ event: string; [key: string]: unknown }>;
export type Report = (event: RuntimeEvent) => void;

async function clientFor(config: KeeperConfig) {
  const base = connection(config.baseUrl, config.network);
  await verifyNetwork(base, config.network, config.expectedGenesis);
  return new FlinchClient({ network: config.network, baseUrl: config.baseUrl, expectedGenesis: config.expectedGenesis },
    config.localErUrl ? new LocalPlacementResolver(base, config.localErUrl) : undefined);
}

export async function inspectKeeper(config: KeeperConfig, report: Report, signal: AbortSignal) {
  const client = await clientFor(config);
  const addresses = [...new Map([...config.rooms, ...config.discovery ? await discoverRooms(client.base, config.discovery, client.programId) : []]
    .map(room => [room.toBase58(), room])).values()];
  for (const address of addresses.slice(0, 128)) {
    signal.throwIfAborted();
    const room = await client.readRoom(address);
    let decision = decide(room);
    if (decision.kind === "resolve") decision = decide(room, await client.resolve(room, signal));
    report({ event: "inspection", room: address.toBase58(), network: config.network, slot: room.slot,
      baseTime: room.now.toString(), revision: room.ledger.economics?.revision.toString() ?? null,
      phase: room.ledger.phase, control: room.control.kind, decision: JSON.parse(JSON.stringify(decision,
        (_, value) => typeof value === "bigint" ? value.toString() : value)) });
  }
}

export type DurableStore = OperationStore & { pendingRooms(): Promise<PublicKey[]> };

export async function runKeeper(config: KeeperConfig, execute: boolean, report: Report, signal: AbortSignal, storage?: DurableStore) {
  if (!execute || !config.keypairFile || !config.payer) throw new KeeperError("execution_required");
  signal.throwIfAborted();
  const release = storage ? async () => {} : await acquireJournal(config.journalDirectory);
  try {
    const client = await clientFor(config);
    const store = storage ?? new FileOperationStore(config.journalDirectory);
    const initialRooms = [...new Map([...config.rooms, ...config.discovery ? await store.pendingRooms() : []]
      .map(room => [room.toBase58(), room])).values()];
    if (initialRooms.length > 128) throw new KeeperError("invalid_config");
    for (const address of initialRooms) {
      signal.throwIfAborted();
      const prior = await store.get(address.toBase58());
      if (prior && prior.genesis !== config.expectedGenesis) throw new KeeperError("invalid_config");
      const room = await client.readRoom(address, prior ? Math.max(prior.observedSlot, prior.runtime === "base" ? prior.confirmationSlot ?? 0 : 0) : undefined);
      if (config.discovery && (!room.ledger.pool.equals(config.discovery.pool) || !room.ledger.validator.equals(config.discovery.validator))) throw new KeeperError("invalid_config");
    }
    const signer = await loadSigner(config.keypairFile, config.payer);
    const previous = new Map<string, string>();
    const catalog = config.discovery ? new RoomCatalog(initialRooms, client, config.discovery, store,
      error => report({ event: "discovery_error", code: errorCode(error) }), { pinned: config.rooms }) : undefined;
    const publish = (room: string, event: RuntimeEvent) => {
      const serialized = JSON.stringify(event);
      if (previous.get(room) !== serialized) { report(event); previous.set(room, serialized); }
    };
    const worker = new RoomWorker(client, signer, store, { messageVersion: config.messageVersion,
      onEvent: event => { publish(event.room, { event: "room", ...event });
        if (event.kind === "done") { catalog?.complete(event.room); previous.delete(event.room); }
      } });
    signal.throwIfAborted();
    report({ event: "ready", network: config.network, payer: signer.publicKey.toBase58(), rooms: config.rooms.map(room => room.toBase58()) });
    try { await runRooms(worker, catalog?.rooms ?? [...config.rooms], signal,
      (room, error) => publish(room, { event: "room_error", room, code: errorCode(error) }), config.concurrency);
    } finally { await catalog?.stop(); }
  } finally { await release(); }
  report({ event: "stopped" });
}
