import { describe, expect, it } from "vitest";
import { formatUnits } from "@flinch/client";
import { control, snapshot } from "../../../tests/keeper/fixtures.ts";
import { roomStatus, seatState, claimable } from "../src/features/match/state.ts";

describe("chain-sourced presentation", () => {
  it("never turns an accepted ER intent into a sale or claim", () => {
    const room = snapshot();
    const er = control(room);
    expect(roomStatus(room, er)).toContain("not sold yet");
    expect(seatState(room, 0, er)).toBe("SELL queued");
    expect(claimable(room, 0, "usdc")).toBe(0n);
    expect(claimable(room, 0, "wsol")).toBe(0n);
  });
  it("recovery requires base time and preserves both assets independently", () => {
    const initial = snapshot(220n);
    expect(roomStatus(initial)).toContain("Recovery available");
    const room = { ...initial, ledger: { ...initial.ledger, economics: { ...initial.ledger.economics!, terminalTag: 4,
      usdcClaims: [15n, 0n, 0n, 0n] as const } } };
    expect(claimable(room, 0, "usdc")).toBe(15n);
    expect(claimable(room, 0, "wsol")).toBe(1_000_000n);
    expect(claimable(room, -1, "wsol")).toBe(0n);
  });
  it("formats every base unit and never hides USDC dust", () => {
    expect(formatUnits(1n, 9)).toBe("0.000000001");
    expect(formatUnits(1n, 6)).toBe("0.000001");
    expect(formatUnits(9_000_000_000_000_001n, 9)).toBe("9000000.000000001");
  });
});
