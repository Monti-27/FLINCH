import { PublicKey } from "@solana/web3.js";
import type { AccountInfo } from "@solana/web3.js";
import type { FlinchProgram, WireAccounts } from "../program.ts";
import { controlAddress, ledgerAddress } from "../addresses.ts";
import { u64 } from "../amounts.ts";
import { check } from "../errors.ts";
import type { Control, Economics, Ledger, Seats } from "../model.ts";

const four = <T>(values: T[]): Seats<T> => {
  check(values.length === 4, "Expected four seats");
  return [values[0], values[1], values[2], values[3]];
};
const units = (value: { toString(): string }) => u64(BigInt(value.toString()));
const sum = (values: readonly bigint[]) => values.reduce((a, b) => a + b, 0n);
const phase = <T extends string>(value: object, allowed: readonly T[]): T => {
  const keys = Object.keys(value);
  check(keys.length === 1 && allowed.includes(keys[0] as T), "Unknown account phase");
  return keys[0] as T;
};

function economics(value: NonNullable<WireAccounts["roomLedger"]["economics"]>): Economics {
  const state = { ...value, startedAt: BigInt(value.startedAt.toString()), revision: units(value.revision),
    holdings: four(value.holdings.map(units)), usdcClaims: four(value.usdcClaims.map(units)),
    initialWsol: units(value.initialWsol), swappedWsol: units(value.swappedWsol), claimedWsol: units(value.claimedWsol),
    receivedUsdc: units(value.receivedUsdc), claimedUsdc: units(value.claimedUsdc) };
  check(state.startedAt >= 0n && state.terminalTag <= 4 && state.terminalSeat < 4, "Invalid economic state");
  check(state.nextCohort < 45 && state.revision <= BigInt(state.nextCohort + 1), "Invalid economic revision");
  check(state.terminalTag === 1 || state.terminalSeat === 0, "Invalid terminal seat");
  check(state.initialWsol === state.swappedWsol + state.claimedWsol + sum(state.holdings), "WSOL does not conserve");
  check(state.receivedUsdc === state.claimedUsdc + sum(state.usdcClaims), "USDC does not conserve");
  return state;
}

function owned(info: AccountInfo<Buffer> | null, programId: PublicKey): asserts info is AccountInfo<Buffer> {
  check(info && !info.executable && info.owner.equals(programId), "Account is not owned by FLINCH");
}

export function decodeLedger(program: FlinchProgram, address: PublicKey, info: AccountInfo<Buffer> | null): Ledger {
  owned(info, program.programId);
  const raw = program.coder.accounts.decode<WireAccounts["roomLedger"]>("roomLedger", info.data);
  const nonce = units(raw.nonce);
  const [expected, bump] = ledgerAddress(raw.host, nonce, program.programId);
  check(raw.version === 2 && expected.equals(address) && bump === raw.bump, "Invalid Ledger identity");
  const state = { ...raw, address, nonce, stake: units(raw.stake), fundingDeadline: BigInt(raw.fundingDeadline.toString()),
    wallets: four(raw.wallets), sessionSigners: four(raw.sessionSigners), refunded: four(raw.refunded),
    phase: phase(raw.phase, ["funding", "cancelled", "started"] as const), economics: raw.economics ? economics(raw.economics) : null };
  check(state.stake >= 1_000_000n && state.stake <= 10_000_000n, "Unsupported stake");
  check((state.phase === "started") === !!state.economics, "Invalid Ledger phase");
  check(!raw.host.equals(PublicKey.default) && !raw.validator.equals(PublicKey.default) && !raw.pool.equals(PublicKey.default), "Missing room identity");
  const members = state.wallets.filter(key => !key.equals(PublicKey.default));
  check(new Set(members.map(key => key.toBase58())).size === members.length, "Duplicate wallet membership");
  check(state.wallets.slice(0, members.length).every(key => !key.equals(PublicKey.default)), "Noncontiguous wallet membership");
  check(state.phase !== "started" || members.length === 4, "Started room is not full");
  if (state.economics) check(state.economics.initialWsol === state.stake * 4n, "Invalid initial stake");
  return state;
}

export function decodeControl(program: FlinchProgram, ledger: Ledger, info: AccountInfo<Buffer> | null): Control {
  owned(info, program.programId);
  const raw = program.coder.accounts.decode<WireAccounts["roomControl"]>("roomControl", info.data);
  const [address, bump] = controlAddress(ledger.address, program.programId);
  check(raw.version === 2 && raw.bump === bump && raw.ledger.equals(ledger.address), "Invalid Control identity");
  check(raw.validator.equals(ledger.validator), "Unexpected Control validator");
  const state = { ...raw, address, startedAt: BigInt(raw.startedAt.toString()), revision: units(raw.revision),
    phase: phase(raw.phase, ["prepared", "live", "frozen", "resolved"] as const),
    wallets: four(raw.wallets), sessionSigners: four(raw.sessionSigners), holdings: four(raw.holdings.map(units)),
    attempts: four(raw.attempts), nonces: four(raw.nonces.map(units)), minimumOutputs: four(raw.minimumOutputs.map(units)) };
  check(state.sellers <= 15 && state.attempts.every(value => value <= 3), "Invalid intent bounds");
  check(state.startedAt >= 0n && state.nextCohort < 45 && state.cohortIndex < 45, "Invalid Control timing");
  check(state.phase !== "frozen" || state.sellers !== 0, "Frozen Control has no sellers");
  check(!["prepared", "resolved"].includes(state.phase) || state.sellers === 0, "Inactive Control has pending sellers");
  check(state.sellers === 0 || state.cohortIndex >= state.nextCohort, "Control cohort precedes Ledger");
  for (let seat = 0; seat < 4; seat++) {
    check(state.wallets[seat].equals(ledger.wallets[seat]) && state.sessionSigners[seat].equals(ledger.sessionSigners[seat]), "Control membership differs");
    const selling = (state.sellers & (1 << seat)) !== 0;
    check(selling === (state.minimumOutputs[seat] > 0n), "Control minimum differs from seller membership");
    check(!selling || state.holdings[seat] > 0n && state.attempts[seat] > 0 && state.nonces[seat] > 0n, "Control seller has no authorized holding");
    check((state.attempts[seat] === 0) === (state.nonces[seat] === 0n), "Control attempt and nonce differ");
  }
  return state;
}

export function matchesLedger(control: Control, ledger: Ledger): boolean {
  const e = ledger.economics;
  return !!e && control.revision === e.revision && control.startedAt === e.startedAt && control.nextCohort === e.nextCohort
    && control.holdings.every((amount, seat) => amount === e.holdings[seat]);
}
