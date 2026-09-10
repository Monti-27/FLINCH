import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { DEVNET_GENESIS } from "@flinch/client";
import type { BaseRoom, FlinchClient, SellQuote, TransactionSigner } from "@flinch/client";

const key = (value: number) => new PublicKey(new Uint8Array(32).fill(value));
export const fixtureSigner: TransactionSigner = { publicKey: key(1), sign: async () => { throw new Error("Fixture never signs"); } };
export const fixtureClient = { config: { expectedGenesis: DEVNET_GENESIS }, instructions: {
  claim: async () => new TransactionInstruction({ programId: key(10), keys: [] }),
  recover: async () => new TransactionInstruction({ programId: key(10), keys: [] }),
} } as unknown as FlinchClient;

export function ticketRoom(state: string): BaseRoom {
  const funding = ["entry", "joined", "full", "expired"].includes(state);
  const closed = ["refund", "claimed"].includes(state);
  const room: BaseRoom = { now: state === "expired" ? 301n : state === "recovery" ? 230n : 101n, slot: 50,
    control: { kind: "delegated" }, ledger: {
      address: key(5), host: key(1), nonce: 0n, validator: key(6), pool: key(7), stake: 4_000_000n,
      fundingDeadline: 300n, phase: funding ? "funding" : closed ? "cancelled" : "started",
      wallets: funding && state !== "full" ? [key(1), PublicKey.default, PublicKey.default, PublicKey.default] : [key(1), key(2), key(3), key(4)],
      sessionSigners: [key(8), PublicKey.default, PublicKey.default, PublicKey.default], refunded: [state === "claimed", false, false, false],
      economics: funding || closed ? null : { startedAt: 100n, revision: 0n, nextCohort: 0, holdings: [0n, 4_000_000n, 4_000_000n, 4_000_000n],
        usdcClaims: [state === "recovery" ? 0n : 105_321n, 0n, 0n, 0n], initialWsol: 16_000_000n, swappedWsol: 4_000_000n,
        claimedWsol: 0n, receivedUsdc: 105_321n, claimedUsdc: 0n, terminalTag: 0, terminalSeat: 0 },
    } };
  return room;
}

export const ticketQuote: SellQuote = { ledger: key(5), pool: key(7), revision: 0n, seat: 0, nonce: 1n, sellers: 0,
  cohortIndex: 0, holdings: [4_000_001n, 4_000_000n, 4_000_000n, 4_000_000n], minimumOutput: 103_003n,
  outputLow: 104_003n, outputHigh: 105_321n, penaltyMaximum: 10_000n, slippageBps: 100, poolSlot: 50, receivedAtMs: 1000, expiresAtMs: 3000 };
