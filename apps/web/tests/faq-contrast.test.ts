import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const palette = readFileSync(new URL("../src/styles/palette.css", import.meta.url), "utf8");
const faq = readFileSync(new URL("../src/features/landing/faq.module.css", import.meta.url), "utf8");
const declarations = Object.fromEntries([...`${palette}\n${faq}`.matchAll(/--([a-z0-9-]+): ([^;]+);/g)].map(match => [match[1], match[2]]));
const rgb = (hex: string) => [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
const resolve = (name: string): number[] => {
  const value = declarations[name];
  const alias = /^var\(--([a-z0-9-]+)\)$/.exec(value);
  return alias ? resolve(alias[1]) : rgb(value);
};
const luminance = (color: number[]) => color.map(value => value / 255)
  .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  .reduce((total, value, index) => total + value * [0.2126, 0.7152, 0.0722][index], 0);

it.each([["faq-text", 4.5], ["faq-icon", 3], ["color-shadow-grey-950", 4.5], ["color-twilight-indigo-600", 3]] as const)(
  "keeps %s readable over every possible color-flow pixel", (foreground, minimum) => {
    const colors = ["faq-blue", "faq-amber", "faq-red"].map(resolve);
    const paper = resolve("color-alabaster-grey-50").map(value => value * 0.36 + 255 * 0.64);
    const darkest = paper.map((value, index) => Math.min(...colors.map(color => color[index])) * 0.72 + value * 0.28);
    expect((luminance(darkest) + 0.05) / (luminance(resolve(foreground)) + 0.05)).toBeGreaterThanOrEqual(minimum);
    expect(faq).toContain("--faq-title: var(--ink)");
  },
);
