import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { LandingPage } from "../src/features/landing/landing-page.tsx";
import { RevealWords } from "../src/features/landing/reveal-words.tsx";

describe("landing page", () => {
  it("renders the complete story and honest test-build disclosure before hydration", () => {
    const html = renderToStaticMarkup(<LandingPage />);
    const content = html.replace(/<[^>]*>/g, "");
    for (const text of ["Four players.", "Who flinches first?", "Test tokens only", "0.25%",
      "acceptance alone is not a sale", "Multiple holders", "deployed on Solana Devnet", "No real-money wagering"]) expect(content).toContain(text);
    expect(content).not.toContain("not deployed yet");
    expect(html).not.toContain("Illustrations, not live gameplay");
    expect(html).not.toContain("Connect wallet");
    expect(html).not.toContain("Loading FLINCH");
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html.match(/<details/g)?.length).toBeGreaterThanOrEqual(6);
    expect(html).toContain('href="/play"');
    expect(html).toContain('href="#onchain"');
    expect(html).toContain('aria-label="About FLINCH"');
  });

  it("renders an original four-player dot-matrix hero without a photo or live data", () => {
    const html = renderToStaticMarkup(<LandingPage />);
    const hero = html.match(/<section[^>]*aria-labelledby="landing-title"[\s\S]*?<\/section>/)?.[0];
    expect(hero).toBeDefined();
    expect(hero).toContain('data-hero-art="standoff"');
    expect(hero?.match(/data-hero-player="hold"/g)).toHaveLength(3);
    expect(hero?.match(/data-hero-player="sell"/g)).toHaveLength(1);
    expect(hero).toContain("Dot-matrix illustration");
    expect(hero).toContain("Sell your WSOL. Pay the players who hold.");
    expect(hero).toContain("How to play");
    expect(hero).not.toContain("A game of nerve on Solana");
    expect(hero).not.toContain("The first move is yours");
    expect(hero).not.toContain("data-reveal");
    expect(hero!.indexOf("<h1")).toBeLessThan(hero!.indexOf("<figure"));
    expect(hero).not.toMatch(/<img|<canvas|<image|mountain|fetch\(|Math.random/);
    expect(html).not.toContain("Sergey Pesterev");
    const source = readFileSync(new URL("../src/features/landing/hero-standoff.tsx", import.meta.url), "utf8");
    expect(source).not.toMatch(/use client|useEffect|setInterval|MarketProvider|WalletProvider/);
  });

  it("preserves real text and word spacing in reveal markup without duplicating accessible content", () => {
    const html = renderToStaticMarkup(<RevealWords>Who flinches first?</RevealWords>);
    expect(html.replace(/<[^>]*>/g, "")).toBe("Who flinches first?");
    expect(html.match(/data-word=/g)).toHaveLength(3);
    expect(html).not.toMatch(/aria-hidden|opacity|filter|style=/);
  });

  it("keeps one new bento and removes the old rule grid without duplicating the footer", () => {
    const html = renderToStaticMarkup(<LandingPage />);
    expect(html.match(/<footer\b/g)).toHaveLength(1);
    expect(html).toContain('data-theme="light"');
    expect(html).not.toContain("The next move is yours");
    expect(html).not.toContain("Pause motion");
    expect(html.indexOf("</main>")).toBeLessThan(html.indexOf("<footer"));
    expect(html.match(/<article\b[^>]*\bdata-bento-card="/g)).toHaveLength(5);
    expect(html.match(/id="onchain"/g)).toHaveLength(1);
    expect(html.match(/id="how-it-works"/g)).toHaveLength(1);
    expect(html).not.toContain("data-story-chapter");
    expect(html).not.toContain("Simple rules. Interesting people.");
    expect(html).not.toContain("data-story-stage");
    expect(html).not.toContain("position:sticky");
  });

  it("keeps the landing composition separate from wallet, market and transaction providers", () => {
    const source = readFileSync(new URL("../src/features/landing/landing-page.tsx", import.meta.url), "utf8");
    expect(source).not.toMatch(/webClient|webConfig\(|Application|WalletProvider|MarketProvider/);
    const play = readFileSync(new URL("../src/app/play/page.tsx", import.meta.url), "utf8");
    expect(play).toContain("<Application />");
  });
});
