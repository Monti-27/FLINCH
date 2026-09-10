import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const palette = readFileSync(new URL("../src/styles/palette.css", import.meta.url), "utf8");
const colors = Object.fromEntries([...palette.matchAll(/--color-([\w-]+): (#[a-f\d]{6});/g)].map(match => [match[1], match[2]]));
const rgb = (name: string) => [1, 3, 5].map(offset => parseInt((colors[name] ?? name).slice(offset, offset + 2), 16));
const luminance = (color: number[]) => color.map(value => value / 255)
  .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
  .reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
const contrast = (foreground: number[], background: number[]) => {
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
};

it.each([
  ["alabaster-grey-50", "shadow-grey-950"], ["alabaster-grey-300", "shadow-grey-800"],
  ["alabaster-grey-300", "twilight-indigo-900"], ["twilight-indigo-200", "twilight-indigo-900"],
  ["twilight-indigo-300", "shadow-grey-900"], ["shadow-grey-950", "alabaster-grey-200"],
  ["twilight-indigo-900", "twilight-indigo-400"], ["twilight-indigo-900", "twilight-indigo-300"],
  ["twilight-indigo-50", "twilight-indigo-600"],
])("keeps %s text readable on %s including bento gradient endpoints", (foreground, background) => {
  expect(contrast(rgb(foreground), rgb(background))).toBeGreaterThanOrEqual(4.5);
});

it("keeps FAQ text and icons readable across the full dark flow palette", () => {
  const surfaces = ["twilight-indigo-800", "shadow-grey-700", "twilight-indigo-900"].map(rgb);
  const brightest = [0, 1, 2].map(i => Math.max(...surfaces.map(color => color[i])));
  expect(contrast(rgb("alabaster-grey-200"), brightest)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(rgb("alabaster-grey-300"), brightest)).toBeGreaterThanOrEqual(3);
});
