import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MAX_FLOWERS, keyboardPosition, plantFlower } from "../src/features/not-found/garden-state.ts";
import type { Flower } from "../src/features/not-found/garden-state.ts";
import { flowerPixels, housePixels, pixelPath } from "../src/features/not-found/garden-sprites.ts";
import NotFound from "../src/app/not-found.tsx";

describe("pixel garden", () => {
  it("keeps the last 48 flowers without mutating the previous state", () => {
    let flowers: Flower[] = [];
    const original = flowers;
    for (let id = 0; id < 100; id++) flowers = plantFlower(flowers, id, 50, 60);
    expect(original).toEqual([]);
    expect(flowers).toHaveLength(MAX_FLOWERS);
    expect(flowers[0].id).toBe(52);
    expect(flowers.at(-1)?.id).toBe(99);
    expect(new Set(flowers.map(flower => flower.id)).size).toBe(MAX_FLOWERS);
  });

  it("contains edge clicks and rejects invalid coordinates", () => {
    expect(plantFlower([], 0, -100, 200)[0]).toMatchObject({ x: 6, y: 94 });
    expect(plantFlower([], 0, 200, -100)[0]).toMatchObject({ x: 94, y: 22 });
    expect(plantFlower([], 0, NaN, 20)).toEqual([]);
    expect(plantFlower([], 0, 20, Infinity)).toEqual([]);
  });

  it("gives keyboard activation a deterministic location away from the house", () => {
    for (let id = 0; id < 100; id++) {
      const point = keyboardPosition(id);
      expect(point.x).toBeGreaterThanOrEqual(16);
      expect(point.x).toBeLessThan(84);
      expect(point.y).toBeGreaterThanOrEqual(62);
      expect(point.y).toBeLessThan(90);
    }
    expect(keyboardPosition(0)).not.toEqual(keyboardPosition(1));
  });

  it("draws bounded original pixel art and three distinct flowers", () => {
    expect(housePixels().length).toBeGreaterThan(400);
    expect(housePixels().every(([x, y]) => x >= 0 && x < 48 && y >= 0 && y < 42)).toBe(true);
    const flowers = [0, 1, 2].map(variant => pixelPath(flowerPixels(variant)));
    expect(new Set(flowers).size).toBe(3);
    for (const path of flowers) expect(path).toMatch(/^M[\d.]+ [\d.]+h1\.6v1\.6h-1\.6Z/);
  });

  it("server-renders a usable recovery page without adding a footer or loading a wallet", () => {
    const html = renderToStaticMarkup(<NotFound />);
    expect(html).toContain("This page wandered off.");
    expect(html).toContain('aria-label="Plant a flower"');
    expect(html).toContain('aria-describedby="garden-instructions"');
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/play"');
    expect(html).toContain("<noscript>");
    expect(html).toContain('aria-live="polite"');
    expect(html).not.toMatch(/<footer|<canvas|Connect wallet/);
    expect(html.match(/<h1\b/g)).toHaveLength(1);
  });
});
