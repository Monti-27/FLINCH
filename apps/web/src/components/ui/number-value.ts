export type NumberValue = string | number | bigint | null | undefined;
export type NumberDirection = -1 | 0 | 1;

const numericFormat = new Intl.NumberFormat("en-US", { useGrouping: false, maximumFractionDigits: 18 });

export function normalizeNumber(value: NumberValue): string | null {
  if (value == null) return null;
  if (typeof value === "number" && (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER)) return null;
  const raw = typeof value === "number" ? numericFormat.format(value) : String(value);
  if (typeof value === "number" && value !== 0 && !/[1-9]/.test(raw)) return null;
  const match = /^([+-]?)(\d{1,60})(?:\.(\d{1,18}))?$/.exec(raw);
  if (!match) return null;
  const [, sign, integer, fraction] = match;
  const whole = integer.replace(/^0+(?=\d)/, "");
  const negative = sign === "-" && /[1-9]/.test(whole + (fraction ?? ""));
  return `${negative ? "-" : ""}${whole}${fraction === undefined ? "" : `.${fraction}`}`;
}

export function numberDirection(previous: string | null, current: string | null): NumberDirection {
  if (previous === null || current === null) return 0;
  const units = (value: string) => {
    const [whole, fraction = ""] = value.replace(/^-/, "").split(".");
    const magnitude = BigInt(whole + fraction.padEnd(18, "0"));
    return value.startsWith("-") ? -magnitude : magnitude;
  };
  const before = units(previous);
  const after = units(current);
  return after > before ? 1 : after < before ? -1 : 0;
}

export type NumberChange = { value: string | null; direction: NumberDirection; revision: number };

export function advanceNumber(previous: NumberChange, value: string | null): NumberChange {
  if (previous.value === value) return previous;
  return { value, direction: numberDirection(previous.value, value), revision: previous.revision + 1 };
}
