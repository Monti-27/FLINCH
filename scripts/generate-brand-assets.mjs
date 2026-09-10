import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { BRAND_PATHS } from "../apps/web/src/components/brand/geometry.ts";

const root = resolve(import.meta.dirname, "..");
const require = createRequire(resolve(root, "apps/web/package.json"));
const sharp = createRequire(require.resolve("next/package.json"))("sharp");
const check = process.argv.includes("--check");
const palette = await readFile(resolve(root, "apps/web/src/styles/palette.css"), "utf8");
const color = name => {
  const value = palette.match(new RegExp(`--color-${name}: (#[0-9a-f]{6});`))?.[1];
  assert(value, `Missing brand color ${name}`);
  return value;
};
const ink = color("shadow-grey-950");
const paper = color("alabaster-grey-100");
const paths = BRAND_PATHS.map(d => `<path d="${d}"/>`).join("");
const svg = (viewBox, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="FLINCH">${body}</svg>\n`;
const icon = svg("0 0 328 328", `<rect width="328" height="328" rx="64" fill="${ink}"/><g fill="${paper}" transform="translate(12 0)">${paths}</g>`);
const touch = svg("0 0 328 328", `<rect width="328" height="328" fill="${ink}"/><g fill="${paper}" transform="translate(12 0)">${paths}</g>`);
const files = [
  ["apps/web/public/brand/flinch.svg", svg("0 0 304 328", `<g fill="${ink}">${paths}</g>`)],
  ["apps/web/public/brand/flinch-light.svg", svg("0 0 304 328", `<g fill="${paper}">${paths}</g>`)],
  ["apps/web/src/app/icon.svg", icon],
  ["apps/web/src/app/apple-icon.png", await sharp(Buffer.from(touch)).resize(180, 180).png().toBuffer()],
];
const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map(size => sharp(Buffer.from(icon)).resize(size, size).png().toBuffer()));
const header = Buffer.alloc(6 + images.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);
let offset = header.length;
for (const [index, image] of images.entries()) {
  const entry = 6 + index * 16;
  header[entry] = sizes[index];
  header[entry + 1] = sizes[index];
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(image.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += image.length;
}
files.push(["apps/web/src/app/favicon.ico", Buffer.concat([header, ...images])]);
for (const [file, content] of files) {
  const destination = resolve(root, file);
  if (check) assert((await readFile(destination)).equals(Buffer.from(content)), `${file} differs from the canonical logo; run the brand:generate script`);
  else { await mkdir(dirname(destination), { recursive: true }); await writeFile(destination, content); }
}
console.log(`${check ? "Verified" : "Generated"} ${files.length} brand assets from the approved SVG geometry`);
