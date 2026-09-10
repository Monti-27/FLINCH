import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { formatUnits } from "@flinch/client";
import AnimatedNumberCounter from "../src/components/ui/count-down-numbers.tsx";
import { advanceNumber, normalizeNumber, numberDirection } from "../src/components/ui/number-value.ts";
import { Badge } from "../src/components/ui/badge.tsx";

describe("exact numeric presentation", () => {
  it.each([null, undefined, NaN, Infinity, -Infinity, 1e-19, "", "1e9", "oops", "1,000", "0.0000000000000000001", Number.MAX_SAFE_INTEGER + 1])("rejects unavailable or unsafe input %s", value => {
    expect(normalizeNumber(value)).toBeNull();
    const html = renderToStaticMarkup(<AnimatedNumberCounter value={value} />);
    expect(html).toContain('aria-label="No data"');
    expect(html).not.toContain("number-flow-react");
  });

  it.each([[-0, "0"], ["-0.00", "0.00"], ["+0001.20", "1.20"], [0.000000001, "0.000000001"],
    ["18446744073.709551615", "18446744073.709551615"], [18446744073709551615n, "18446744073709551615"]])("preserves %s as %s", (value, expected) => {
    expect(normalizeNumber(value)).toBe(expected);
  });

  it("server-renders the maximum token balance with every base unit intact", () => {
    for (const decimals of [6, 9]) {
      const exact = formatUnits((1n << 64n) - 1n, decimals);
      const html = renderToStaticMarkup(<AnimatedNumberCounter value={exact} />);
      expect(html).toContain(`aria-label="${exact}"`);
      expect(html).toContain(`<span>${exact}</span>`);
      expect(html).toContain('data-number-direction="neutral"');
      expect(html).toContain('data-number-motion="disabled"');
    }
  });

  it("uses the supplied precision, affixes and padding without fake initial zero", () => {
    const html = renderToStaticMarkup(<AnimatedNumberCounter value="142.10" prefix="$" />);
    expect(html).toContain('aria-label="$142.10"');
    expect(html).not.toContain('aria-label="$0.00"');
    expect(renderToStaticMarkup(<AnimatedNumberCounter value={5n} minimumIntegerDigits={2} flashOnChange={false} />)).toContain('aria-label="05"');
    expect(renderToStaticMarkup(<AnimatedNumberCounter value="-0.00" suffix="%" />)).toContain('aria-label="0.00%"');
  });
});

describe("direction and feedback lifecycle", () => {
  it.each([["0.1", "0.2", 1], ["12", "9", -1], ["-1", "-0.1", 1], ["-1", "-2", -1],
    ["1.00", "1", 0], [null, "1", 0], ["1", null, 0], ["9.999999999", "10", 1],
    ["18446744073.709551614", "18446744073.709551615", 1],
    ["18446744073.709551615", "18446744073.709551614", -1]] as const)("compares %s to %s exactly", (before, after, expected) => {
    expect(numberDirection(before, after)).toBe(expected);
  });

  it("restarts feedback on consecutive changes in the same direction but not unrelated renders", () => {
    const first = { value: "1", direction: 0 as const, revision: 0 };
    expect(advanceNumber(first, "1")).toBe(first);
    const second = advanceNumber(first, "2");
    const third = advanceNumber(second, "3");
    expect(second).toEqual({ value: "2", direction: 1, revision: 1 });
    expect(third).toEqual({ value: "3", direction: 1, revision: 2 });
    expect(advanceNumber(third, null)).toEqual({ value: null, direction: 0, revision: 3 });
    expect(advanceNumber(advanceNumber(third, null), "100").direction).toBe(0);
  });

  it("provides the requested badge variants without introducing a demo into gameplay", () => {
    const html = renderToStaticMarkup(<Badge variant="outline">Number preview</Badge>);
    expect(html).toContain("Number preview");
    expect(html).toContain("outline");
  });
});
