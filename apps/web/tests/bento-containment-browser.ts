import assert from "node:assert/strict";
import { resolve } from "node:path";
import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { TIMING } from "../src/features/landing/bento/bento-motion.tsx";

export async function checkBentoContainment(page: Page, directory: string) {
  const results = [];
  const duration = TIMING.phases.reduce((sum, value) => sum + value, 0) * 2 + 600;
  for (const width of [320, 375, 621, 768, 901, 1280, 1920]) {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width, height: 1100 });
    await page.locator('[data-bento-card="custody"]').scrollIntoViewIfNeeded();
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(page.locator('[data-bento-card="rollup"]')).toHaveAttribute("data-running", "true");
    const result = await page.locator("#onchain").evaluate((section, duration) => new Promise<{
      frames: number; minimumGap: number; minimumInset: number; phases: string[][]; cycles: number[]; violations: string[];
    }>(finish => {
      const cards = [...section.querySelectorAll<HTMLElement>('[data-bento-card="custody"], [data-bento-card="rollup"]')];
      const nodes = cards.map(card => [...card.querySelectorAll<HTMLElement>("[data-bento-contained], [data-stake-asset] > span, strong, small, span:not(:has(*)), img")]);
      const startCycles = cards.map(card => Number(card.dataset.cycle));
      const phases = cards.map(() => new Set<string>());
      const violations = new Set<string>();
      let frames = 0;
      let minimumGap = Infinity;
      let minimumInset = Infinity;
      const start = performance.now();
      const sample = (now: number) => {
        frames++;
        cards.forEach((card, index) => {
          phases[index].add(card.dataset.phase!);
          const art = card.firstElementChild!.getBoundingClientRect();
          nodes[index].forEach(node => {
            const style = getComputedStyle(node);
            if (style.opacity === "0" || (!node.textContent?.trim() && node.tagName !== "IMG" && !node.hasAttribute("data-bento-contained"))) return;
            const rect = node.getBoundingClientRect();
            const inset = Math.min(rect.left - art.left, art.right - rect.right, rect.top - art.top, art.bottom - rect.bottom);
            minimumInset = Math.min(minimumInset, inset);
            if (inset < -0.5) violations.add(`${card.dataset.bentoCard}: ${node.tagName} ${node.textContent} leaves art by ${-inset}px`);
            let parent = node.parentElement;
            while (parent && parent !== card) {
              const parentStyle = getComputedStyle(parent);
              const box = parent.getBoundingClientRect();
              if (/hidden|clip/.test(parentStyle.overflowX) && (rect.left < box.left - .5 || rect.right > box.right + .5)) violations.add(`${node.textContent} clipped horizontally`);
              if (/hidden|clip/.test(parentStyle.overflowY) && (rect.top < box.top - .5 || rect.bottom > box.bottom + .5)) violations.add(`${node.textContent} clipped vertically`);
              parent = parent.parentElement;
            }
          });
        });
        const packet = section.querySelector("[data-rollup-packet]")!.getBoundingClientRect();
        const base = section.querySelector("[data-rollup-custody]")!.getBoundingClientRect();
        minimumGap = Math.min(minimumGap, base.top - packet.bottom);
        if (now - start < duration) requestAnimationFrame(sample);
        else finish({ frames, minimumGap, minimumInset, phases: phases.map(values => [...values]),
          cycles: cards.map((card, index) => Number(card.dataset.cycle) - startCycles[index]), violations: [...violations] });
      };
      requestAnimationFrame(sample);
    }), duration);
    assert.deepEqual(result.violations, [], `${width}px clipping: ${result.violations.join("; ")}`);
    assert(result.minimumGap >= 12, `${width}px: Control panel must clear custody throughout its return`);
    assert(result.minimumInset >= 16, `${width}px: meaningful content needs breathing room at all edges`);
    assert(result.phases.every(phases => phases.length === 4), `${width}px: all phases must be sampled`);
    assert(result.cycles.every(cycles => cycles >= 2), `${width}px: both reset transitions must be sampled`);
    for (const name of ["custody", "rollup"]) {
      await page.locator(`[data-bento-card="${name}"]`).screenshot({ path: resolve(directory, `${name}-loop-${width}.png`),
        style: 'header:has(a[aria-label="FLINCH home"]), nextjs-portal { visibility: hidden; }' });
    }
    results.push({ width, ...result });
    console.log(`Full-cycle bounds passed at ${width}px across ${result.frames} frames`);
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  return results;
}
