import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const footerCss = readFileSync(new URL("../src/styles/footer.css", import.meta.url), "utf8");
const css = ["palette", "tokens"].map(name => readFileSync(new URL(`../src/styles/${name}.css`, import.meta.url), "utf8")).join("\n") + footerCss.split('.app-footer[data-theme="light"]')[0];
const declarations = Object.fromEntries([...css.matchAll(/--([a-z0-9-]+): ([^;]+);/g)].map(match => [match[1], match[2]]));

function token(name: string, visited = new Set<string>()): string {
  if (visited.has(name)) throw new Error(`Circular color token: ${name}`);
  visited.add(name);
  const value = declarations[name];
  if (!value) throw new Error(`Missing color token: ${name}`);
  const alias = /^var\(--([a-z0-9-]+)\)$/.exec(value);
  if (alias) return token(alias[1], visited);
  if (!/^#[0-9a-f]{6}$/.test(value)) throw new Error(`Unsupported color token: ${name}`);
  return value;
}

function luminance(hex: string) {
  const rgb = [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}

it.each([
  ["foreground", "background", 4.5], ["foreground", "card", 4.5],
  ["muted-foreground", "card", 4.5], ["muted-foreground", "surface-raised", 4.5],
  ["primary-foreground", "primary", 4.5], ["positive", "chart", 4.5],
  ["negative", "negative-surface", 4.5], ["ring", "card", 3], ["input-border", "background", 3],
  ["chart-up", "chart", 3], ["chart-down", "chart", 3], ["negative", "card", 4.5],
  ["chart-text", "chart-surface", 4.5], ["chart-muted", "chart", 4.5],
  ["chart-muted", "chart-surface", 4.5], ["chart-text", "chart-selected", 4.5],
  ["chart", "chart-up", 4.5], ["chart", "chart-down", 4.5],
  ["chart-crosshair", "chart", 3],
  ["muted-foreground", "sidebar", 4.5], ["accent", "surface-raised", 4.5],
  ["foreground", "sidebar", 4.5], ["input-border", "card", 3],
  ["foreground", "rail", 4.5], ["muted-foreground", "rail", 4.5],
  ["slot-border", "rail", 3], ["ring", "rail", 3],
  ["muted-foreground", "muted", 4.5], ["foreground", "muted", 4.5],
  ["accent", "selected", 4.5], ["chart-line", "chart", 3],
  ["primary-border", "background", 3],
  ["primary-foreground", "action-top", 4.5], ["primary-foreground", "action-bottom", 4.5],
  ["muted-foreground", "inset", 4.5], ["foreground", "inset", 4.5],
  ["foreground", "nav-surface", 4.5], ["muted-foreground", "nav-surface", 4.5],
  ["ring", "nav-surface", 3],
  ["accent", "action-disabled", 4.5], ["foreground", "panel-face", 4.5],
  ["muted-foreground", "panel-face", 4.5], ["muted-foreground", "seat-selected", 4.5],
  ["input-border", "inset", 3],
  ["accent", "background", 4.5], ["muted-foreground", "background", 4.5],
  ["footer-text", "footer-ink", 4.5],
  ["footer-pale", "footer-ink", 3],
  ["footer-text", "background", 4.5], ["footer-pale", "background", 4.5],
  ["color-twilight-indigo-200", "background", 4.5], ["hand-ice", "background", 4.5],
] as const)("keeps %s readable against %s", (foreground, background, minimum) => {
  const values = [luminance(token(foreground)), luminance(token(background))].sort((a, b) => b - a);
  expect((values[0] + 0.05) / (values[1] + 0.05)).toBeGreaterThanOrEqual(minimum);
});

it.each(["color-alabaster-grey-600", "color-shadow-grey-950", "color-twilight-indigo-600"])("keeps light footer %s readable", foreground => {
  expect((luminance(token("color-alabaster-grey-50")) + 0.05) / (luminance(token(foreground)) + 0.05)).toBeGreaterThanOrEqual(4.5);
});

it("keeps the light footer's teal wordmark readable throughout its cycle", () => {
  const teal = footerCss.split('.app-footer[data-theme="light"]')[1].match(/--footer-center-b: (#[a-f\d]{6})/)![1];
  expect((luminance(token("color-alabaster-grey-50")) + 0.05) / (luminance(teal) + 0.05)).toBeGreaterThanOrEqual(4.5);
});

it("protects footer text against the brightest possible shader pixel", () => {
  const scrim = declarations["footer-scrim"];
  expect(scrim).toMatch(/^#[0-9a-f]{8}$/);
  const alpha = parseInt(scrim.slice(7), 16) / 255;
  const background = "#" + [1, 3, 5].map(offset => Math.round(parseInt(scrim.slice(offset, offset + 2), 16) * alpha + 255 * (1 - alpha)).toString(16).padStart(2, "0")).join("");
  for (const name of ["footer-text", "footer-pale"]) {
    expect((luminance(token(name)) + 0.05) / (luminance(background) + 0.05)).toBeGreaterThanOrEqual(4.5);
  }
});

it.each([
  ["shadow-grey", "f1f1f3 e3e3e8 c7c7d1 acacb9 9090a2 74748b 5d5d6f 464653 2e2e38 17171c 101013"],
  ["twilight-indigo", "eaf0fa d6e2f5 adc5eb 84a8e1 5b8ad7 326dcd 2857a4 1e427b 142c52 0a1629 070f1d"],
  ["alabaster-grey", "f2f2f3 e5e5e6 cacace b0b0b5 96969c 7c7c83 636369 4a4a4f 313135 19191a 111112"],
])("preserves the user's exact %s palette", (name, colors) => {
  [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].forEach((step, index) => {
    expect(token(`color-${name}-${step}`)).toBe(`#${colors.split(" ")[index]}`);
  });
});
