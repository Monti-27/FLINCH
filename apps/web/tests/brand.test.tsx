import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { BRAND_PATHS, BRAND_VIEW_BOX } from "../src/components/brand/geometry.ts";
import { BrandLogo, BrandMark } from "../src/components/brand/logo.tsx";
import { Footer } from "../src/components/shell/footer.tsx";
import { UiProvider } from "../src/providers/ui-provider.tsx";
import ErrorPage from "../src/app/error.tsx";
import NotFound from "../src/app/not-found.tsx";

const read = (file: string) => readFileSync(new URL(file, import.meta.url));

it("preserves both paths of the approved split F without transforming the silhouette", () => {
  expect(BRAND_PATHS).toEqual([
    "M40 160V68C40 48.118 56.118 32 76 32H264L208 88H112Z",
    "M40 182.627 118.627 104H240L184 160H112V224L40 296Z",
  ]);
  expect(BRAND_VIEW_BOX).toBe("40 32 224 264");
  const markup = renderToStaticMarkup(<BrandMark />);
  expect(markup.match(/<path /g)).toHaveLength(2);
  expect(markup).toContain('fill="currentColor"');
  expect(markup).not.toMatch(/<image|<filter|<mask|<script|transform=|stroke=/);
});

it("keeps decorative marks out of screen-reader and keyboard navigation", () => {
  const markup = renderToStaticMarkup(<BrandMark />);
  expect(markup).toContain('aria-hidden="true"');
  expect(markup).toContain('focusable="false"');
  expect(markup).not.toMatch(/role=|tabindex=|aria-label=/);
});

it("supports an accessible name for standalone meaningful marks", () => {
  const markup = renderToStaticMarkup(<BrandMark label="FLINCH" />);
  expect(markup).toContain('role="img"');
  expect(markup).toContain('aria-label="FLINCH"');
  expect(markup).not.toContain("aria-hidden");
});

it("pairs the approved mark with one visible wordmark and no legacy arrow", () => {
  const markup = renderToStaticMarkup(<BrandLogo />);
  expect(markup).toContain('<span class="brand-name">flinch</span>');
  expect(markup.match(/<svg /g)).toHaveLength(1);
  expect(markup).not.toContain("↗");
});

it("reuses the logo in the existing footer without removing its controls or disclosures", () => {
  const markup = renderToStaticMarkup(<UiProvider><Footer config={{ network: "devnet", transactions: false }} /></UiProvider>);
  for (const d of BRAND_PATHS) expect(markup).toContain(`d="${d}"`);
  expect(markup).toContain("MagicBlock");
  expect(markup).toContain("footer-hands");
  expect(markup).toContain("Read the rules");
  expect(markup).toContain("No real-money wagering");
});

it("brands error and missing-page states while retaining recovery actions", () => {
  const error = renderToStaticMarkup(<ErrorPage reset={() => {}} />);
  const missing = renderToStaticMarkup(<NotFound />);
  for (const markup of [error, missing]) expect(markup).toContain('class="brand-logo brand-status"');
  expect(error).toContain("This does not cancel a submitted transaction");
  expect(error).toContain("Reload view");
  expect(missing).toContain('href="/play"');
});

it("ships self-contained SVG downloads and a browser icon with exactly the canonical paths", () => {
  for (const file of ["../public/brand/flinch.svg", "../public/brand/flinch-light.svg", "../src/app/icon.svg"]) {
    const markup = read(file).toString();
    for (const d of BRAND_PATHS) expect(markup).toContain(`d="${d}"`);
    expect(markup.match(/<path /g)).toHaveLength(2);
    expect(markup).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(markup).not.toMatch(/<image|<script|<foreignObject|href=|<text|<!--/);
  }
});

it("uses one surface-aware neutral mark treatment without recoloring its geometry", () => {
  const styles = read("../src/styles/brand.css").toString();
  const landing = read("../src/features/landing/landing.module.css").toString();
  const garden = read("../src/features/not-found/not-found.module.css").toString();
  expect(styles).toContain("color: var(--brand-mark-color, var(--color-alabaster-grey-100))");
  expect(styles).toContain('.app-footer[data-theme="light"] { --brand-mark-color: var(--color-shadow-grey-950); }');
  expect(styles).toContain('.app-footer[data-theme="dark"] { --brand-mark-color: var(--color-alabaster-grey-100); }');
  expect(landing).toContain("--brand-mark-color: var(--ink)");
  expect(garden).toContain("--brand-mark-color: var(--color-shadow-grey-950)");
  expect(landing).not.toMatch(/\.brand-mark[^}]*color:\s*var\(--paper-accent\)/);
  expect(read("../public/brand/flinch-light.svg").toString()).toContain('fill="#e5e5e6"');
});

it("provides a real 180px Apple touch icon", () => {
  const png = read("../src/app/apple-icon.png");
  expect(png.subarray(1, 4).toString()).toBe("PNG");
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([180, 180]);
});

it("provides a valid multi-size favicon with 16, 32 and 48px PNG entries", () => {
  const ico = read("../src/app/favicon.ico");
  expect([ico.readUInt16LE(0), ico.readUInt16LE(2), ico.readUInt16LE(4)]).toEqual([0, 1, 3]);
  let end = 54;
  for (const [index, size] of [16, 32, 48].entries()) {
    const entry = 6 + index * 16;
    const length = ico.readUInt32LE(entry + 8);
    const offset = ico.readUInt32LE(entry + 12);
    expect(offset).toBe(end);
    expect([ico[entry], ico[entry + 1]]).toEqual([size, size]);
    const png = ico.subarray(offset, offset + length);
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([size, size]);
    end += length;
  }
  expect(end).toBe(ico.length);
});
