import anchor from "@coral-xyz/anchor";
import { Connection, Keypair, SystemProgram } from "@solana/web3.js";
import { DEVNET_GENESIS } from "../../packages/client/src/index.ts";
import type { BaseRoom, Control, TransactionSigner } from "../../packages/client/src/index.ts";
import type { ClientPort } from "../../apps/keeper/src/room-worker.ts";
import type { Operation } from "../../apps/keeper/src/store.ts";

export const wallet = Keypair.generate();
export const key = () => Keypair.generate().publicKey;
export const signer: TransactionSigner = { publicKey: wallet.publicKey, sign: async tx => { tx.sign([wallet]); return tx; } };

export function snapshot(now = 101n): BaseRoom {
  return { slot: 50, now, control: { kind: "delegated" }, ledger: {
    address: key(), host: wallet.publicKey, nonce: 0n, validator: key(), pool: key(), stake: 1_000_000n,
    fundingDeadline: 300n, phase: "started", wallets: [wallet.publicKey, key(), key(), key()],
    sessionSigners: [key(), key(), key(), key()], refunded: [false, false, false, false],
    economics: { startedAt: 100n, revision: 0n, nextCohort: 0, holdings: [1_000_000n, 1_000_000n, 1_000_000n, 1_000_000n],
      usdcClaims: [0n, 0n, 0n, 0n], initialWsol: 4_000_000n, swappedWsol: 0n, claimedWsol: 0n,
      receivedUsdc: 0n, claimedUsdc: 0n, terminalTag: 0, terminalSeat: 0 }
  } };
}

export function control(room: BaseRoom, phase: Control["phase"] = "live"): Control {
  const ledger = room.ledger;
  return { address: key(), ledger: ledger.address, validator: ledger.validator, wallets: ledger.wallets,
    sessionSigners: ledger.sessionSigners, ...ledger.economics!, phase,
    attempts: [1, 0, 0, 0], nonces: [1n, 0n, 0n, 0n], sellers: 1, cohortIndex: 0, minimumOutputs: [1n, 0n, 0n, 0n] };
}

export function operation(room: BaseRoom, overrides: Partial<Operation> = {}): Operation {
  return { version: 1, room: room.ledger.address.toBase58(), genesis: DEVNET_GENESIS, action: "freeze", runtime: "er",
    endpoint: "https://devnet-as.magicblock.app/", revision: "0", signature: anchor.utils.bytes.bs58.encode(new Uint8Array(64).fill(7)),
    blockhash: key().toBase58(), lastValidBlockHeight: 150, observedSlot: 49, status: "pending", ...overrides };
}

export function clientPort(initial: BaseRoom) {
  const state = { room: initial, sends: 0, statusReads: 0, resolves: 0, proofs: 0, status: "pending" as "pending" | "confirmed" | "failed" };
  const base = new Connection("http://127.0.0.1:8899");
  base.getLatestBlockhash = async () => ({ blockhash: key().toBase58(), lastValidBlockHeight: 150 });
  base.sendRawTransaction = async () => { state.sends++; throw new Error("network timeout after acceptance"); };
  const build = async () => SystemProgram.transfer({ fromPubkey: wallet.publicKey, toPubkey: wallet.publicKey, lamports: 0 });
  const client: ClientPort = {
    base, config: { network: "localnet", baseUrl: base.rpcEndpoint, expectedGenesis: DEVNET_GENESIS },
    readRoom: async () => state.room,
    resolve: async () => { state.resolves++; throw new Error("ER unavailable"); },
    status: async () => {
      state.statusReads++;
      return state.status === "pending" ? { kind: "pending" } : state.status === "confirmed"
        ? { kind: "confirmed", slot: 50 } : { kind: "failed", slot: 50, error: "test rejection" };
    },
    returnProof: async () => { state.proofs++; return undefined; }, execute: build,
    instructions: { start: build, cancel: build, delegate: build, freeze: build, expire: build, recover: build,
      initialize: build, join: build, session: build, queue: build, claim: build }
  };
  return { state, client };
}
