import type { PublicKey } from "@solana/web3.js";

export type Seats<T> = readonly [T, T, T, T];
export type Economics = Readonly<{
  startedAt: bigint; revision: bigint; nextCohort: number;
  holdings: Seats<bigint>; usdcClaims: Seats<bigint>;
  initialWsol: bigint; swappedWsol: bigint; claimedWsol: bigint;
  receivedUsdc: bigint; claimedUsdc: bigint;
  terminalTag: number; terminalSeat: number;
}>;
export type Ledger = Readonly<{
  address: PublicKey; host: PublicKey; nonce: bigint; validator: PublicKey; pool: PublicKey;
  stake: bigint; fundingDeadline: bigint; phase: "funding" | "cancelled" | "started";
  wallets: Seats<PublicKey>; sessionSigners: Seats<PublicKey>; refunded: Seats<boolean>;
  economics: Economics | null;
}>;
export type Control = Readonly<{
  address: PublicKey; ledger: PublicKey; validator: PublicKey;
  wallets: Seats<PublicKey>; sessionSigners: Seats<PublicKey>;
  startedAt: bigint; revision: bigint; nextCohort: number; holdings: Seats<bigint>;
  phase: "prepared" | "live" | "frozen" | "resolved";
  attempts: Seats<number>; nonces: Seats<bigint>; sellers: number;
  cohortIndex: number; minimumOutputs: Seats<bigint>;
}>;
export type BaseRoom = Readonly<{
  slot: number; now: bigint; ledger: Ledger;
  control: { kind: "missing" } | { kind: "not_required" } | { kind: "delegated" } | { kind: "base"; value: Control };
}>;

export const endsAt = (economics: Economics) => economics.startedAt + 90n;
export const recoveryAt = (economics: Economics) => economics.startedAt + 120n;
export const closesAt = (control: Control) => control.startedAt + BigInt(control.cohortIndex + 1) * 2n;
