import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StakeControl } from "../src/features/lobby/stake-control.tsx";
import { createUiStore } from "../src/stores/ui-store.ts";
import { MAX_STAKE, MIN_STAKE, stakeFromSlider, stakeSliderIndex, stakeUnits, stepStake, validStake } from "../src/features/lobby/stake-value.ts";

describe("exact stake controls", () => {
  it("accepts the configured endpoints and every lamport of a precise draft", () => {
    expect(validStake("0.001")).toBe(MIN_STAKE);
    expect(validStake("0.01")).toBe(MAX_STAKE);
    expect(validStake("0.001000001")).toBe(1_000_001n);
    expect(validStake("0.009999999")).toBe(9_999_999n);
  });

  it.each(["", ".", "0.", "0", "0.000999999", "0.010000001", "0.05", "-0.001", "1e-3", "0,001", "0.0010000001", " 0.001", "00.001", "18446744073709551616"])("rejects invalid or out-of-range draft %s", value => {
    expect(validStake(value)).toBeNull();
  });

  it("steps in exact units without removing manual precision", () => {
    expect(stepStake("0.001000001", 1)).toBe("0.002000001");
    expect(stepStake("0.009999999", -1)).toBe("0.008999999");
    expect(stepStake("0.003000001", 1, true)).toBe("0.003100001");
    expect(stepStake("0.003000001", -1, true)).toBe("0.002900001");
  });

  it("applies every rapid adjustment against the latest store value", () => {
    const store = createUiStore();
    const change = store.getState().setStake;
    change("0.005");
    for (let index = 0; index < 3; index++) change(current => stepStake(current, 1));
    expect(store.getState().stake).toBe("0.008");
    change(current => stepStake(current, -1));
    expect(store.getState().stake).toBe("0.007");
  });

  it("stays inside the allowed range across repeated adjustments", () => {
    let value = "0.001";
    for (let index = 0; index < 100; index++) value = stepStake(value, 1);
    expect(value).toBe("0.01");
    for (let index = 0; index < 100; index++) value = stepStake(value, -1);
    expect(value).toBe("0.001");
    expect(stepStake("0.009999999", 1)).toBe("0.01");
    expect(stepStake("0.001000001", -1)).toBe("0.001");
  });

  it("recovers incomplete drafts only through an explicit adjustment", () => {
    expect(stepStake("", 1)).toBe("0.001");
    expect(stepStake("invalid", -1)).toBe("0.001");
    expect(stepStake("0.05", -1)).toBe("0.01");
    expect(stepStake("0.0005", 1)).toBe("0.001");
  });

  it("maps every slider position to exact token units", () => {
    for (let tick = 0; tick <= 90; tick++) {
      const value = stakeFromSlider(String(tick))!;
      expect(stakeUnits(value)).toBe(MIN_STAKE + BigInt(tick) * 100_000n);
      expect(stakeSliderIndex(value)).toBe(tick);
    }
    expect(stakeSliderIndex("0.001000001")).toBe(0);
    expect(stakeSliderIndex("0.005000001")).toBe(40);
    expect(stakeSliderIndex("0.010000001")).toBe(90);
  });

  it.each(["-1", "91", "1.1", "1e1", "", "NaN"])("rejects invalid slider position %s", value => {
    expect(stakeFromSlider(value)).toBeNull();
  });
});

describe("stake presentation", () => {
  const render = (value: string, disabled = false, invalid = false) => renderToStaticMarkup(
    <StakeControl value={value} onChange={() => {}} disabled={disabled} invalid={invalid} />,
  );

  it("keeps the native decimal input exact and the animation decorative", () => {
    const markup = render("0.001000001");
    expect(markup).toContain('value="0.001000001"');
    expect(markup).toContain('type="text"');
    expect(markup).toContain('inputMode="decimal"');
    expect(markup).toContain('for="stake"');
    expect(markup).toContain('aria-describedby="stake-range-help stake-help"');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('data-number-value="0.001000001"');
    expect(markup).toContain('data-number-direction="neutral"');
  });

  it("does not submit through any adjustment and disables the minimum decrement", () => {
    const markup = render("0.001");
    expect(markup.match(/type="button"/g)).toHaveLength(5);
    expect(markup.match(/Use maximum stake, 0.01 SOL/g)).toHaveLength(1);
    expect(markup).not.toContain('type="submit"');
    expect(markup).toMatch(/aria-label="Decrease stake by 0.001 SOL" disabled/);
    expect(markup).toContain('aria-valuetext="0.001 SOL per player"');
  });

  it("disables the maximum increment and recognizes equivalent exact presets", () => {
    expect(render("0.010000000")).toMatch(/aria-label="Increase stake by 0.001 SOL" disabled/);
    expect(render("0.005000000")).toContain('aria-label="0.005 SOL" aria-pressed="true"');
  });

  it("locks all inputs and adjustments during a pending action", () => {
    expect(render("0.005", true).match(/disabled=""/g)).toHaveLength(7);
  });

  it("preserves partial and invalid text without claiming a valid selection", () => {
    const markup = render("0.", false, true);
    expect(markup).toContain('value="0."');
    expect(markup).toContain('data-invalid="true"');
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('data-selected="false"');
    expect(markup).not.toContain("No data");
  });
});
