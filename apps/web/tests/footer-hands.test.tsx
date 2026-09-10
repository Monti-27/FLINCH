import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { FooterHands } from "../src/components/shell/footer-hands.tsx";

it("server-renders both distinct hands without hiding them behind hydration", () => {
  const markup = renderToStaticMarkup(<FooterHands paused={false} />);
  expect(markup).toContain('aria-hidden="true"');
  expect(markup).toContain('data-running="false"');
  expect(markup).toContain("footer-hand-left");
  expect(markup).toContain("footer-hand-right");
  expect(markup.match(/<canvas/g)).toHaveLength(2);
  expect(markup.match(/footer-hand-flow/g)).toHaveLength(2);
  expect(markup).not.toMatch(/opacity:0|<video|tabindex/);
});

it("preserves an explicit paused preference in server markup", () => {
  expect(renderToStaticMarkup(<FooterHands paused />)).toContain('data-paused="true"');
});

it.each([
  ["left", "3b01c9a2310611ee4c97f3baa9c74dab38d761d61dc33029a483e1332dc915a5"],
  ["right", "4396f1d0f2e8ae827d3009b74e3d89293bb9971f59474e237146bef342f0706b"],
])("retains the reference-derived %s hand without substituting its silhouette", (side, hash) => {
  const asset = readFileSync(new URL(`../public/art/footer/hand-${side}.png`, import.meta.url));
  expect(createHash("sha256").update(asset).digest("hex")).toBe(hash);
  expect(asset.readUInt32BE(16)).toBe(700);
  expect(asset.readUInt32BE(20)).toBe(400);
  expect(asset.length).toBeLessThan(90_000);
});
