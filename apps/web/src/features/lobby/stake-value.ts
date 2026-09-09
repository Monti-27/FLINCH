import { formatUnits, parseUnits } from "@flinch/client";

export const MIN_STAKE = 1_000_000n;
export const MAX_STAKE = 10_000_000n;
export const STAKE_STEP = 1_000_000n;
export const STAKE_TICK = 100_000n;
export const STAKE_PRESETS = ["0.001", "0.005", "0.01"] as const;

export function stakeUnits(value: string): bigint | null {
  try { return parseUnits(value, 9); }
  catch { return null; }
}

export function validStake(value: string): bigint | null {
  const units = stakeUnits(value);
  return units !== null && units >= MIN_STAKE && units <= MAX_STAKE ? units : null;
}

function boundedStake(units: bigint): bigint {
  return units < MIN_STAKE ? MIN_STAKE : units > MAX_STAKE ? MAX_STAKE : units;
}

export function stepStake(value: string, direction: -1 | 1, fine = false): string {
  const units = stakeUnits(value);
  if (units === null || units < MIN_STAKE) return formatUnits(MIN_STAKE, 9);
  if (units > MAX_STAKE) return formatUnits(MAX_STAKE, 9);
  return formatUnits(boundedStake(units + BigInt(direction) * (fine ? STAKE_TICK : STAKE_STEP)), 9);
}

export function stakeSliderIndex(value: string): number {
  return Number((boundedStake(stakeUnits(value) ?? MIN_STAKE) - MIN_STAKE) / STAKE_TICK);
}

export function stakeFromSlider(index: string): string | null {
  if (!/^\d{1,2}$/.test(index)) return null;
  const tick = BigInt(index);
  if (tick > 90n) return null;
  return formatUnits(MIN_STAKE + tick * STAKE_TICK, 9);
}
