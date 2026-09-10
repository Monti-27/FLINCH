import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";
import { UiProvider } from "../src/providers/ui-provider.tsx";
import { ProtocolBento } from "../src/features/landing/bento/protocol-bento.tsx";
import { RollupScene } from "../src/features/landing/bento/rollup-scene.tsx";
import { CustodyScene } from "../src/features/landing/bento/custody-scene.tsx";
import { TIMING } from "../src/features/landing/bento/bento-motion.tsx";
import { createBentoStore, sceneNames, staticScenePhases } from "../src/features/landing/bento/bento-state.ts";

describe("bento motion state", () => {
  it("isolates instances and individual scenes", () => {
    const first = createBentoStore();
    const second = createBentoStore();
    first.getState().advance("rollup");
    expect(first.getState().scenes.rollup.phase).toBe(1);
    expect(first.getState().scenes.custody.phase).toBe(0);
    expect(second.getState().scenes.rollup.phase).toBe(0);
    expect(second.getState().scenes.rollup.cycle).toBe(0);
  });

  it.each(sceneNames)("loops %s through all four phases", name => {
    const store = createBentoStore();
    for (let index = 1; index <= 20; index++) {
      store.getState().advance(name);
      expect(store.getState().scenes[name]).toEqual({ phase: index % 4, cycle: Math.floor(index / 4) });
    }
  });

  it("does not restart neighboring scenes at the loop boundary", () => {
    const store = createBentoStore();
    store.getState().advance("custody");
    for (let index = 0; index < 4; index++) store.getState().advance("settlement");
    expect(store.getState().scenes.settlement).toEqual({ phase: 0, cycle: 1 });
    expect(store.getState().scenes.custody).toEqual({ phase: 1, cycle: 0 });
  });

  it("keeps visibility independent without resetting illustrations", () => {
    const store = createBentoStore();
    store.getState().advance("custody");
    store.getState().setDocumentVisible(true);
    store.getState().setDocumentVisible(false);
    expect(store.getState().documentVisible).toBe(false);
    expect(store.getState().scenes.custody.phase).toBe(1);
  });

  it("gives each phase time to settle before the next movement", () => {
    expect(TIMING.phases.every(duration => duration >= 800)).toBe(true);
    expect(TIMING.phases.reduce((sum, duration) => sum + duration, 0)).toBeLessThan(4500);
    expect(TIMING.phases[3]).toBeGreaterThan(TIMING.phases[0]);
  });
});

describe("bento presentation", () => {
  const html = () => renderToStaticMarkup(<UiProvider><ProtocolBento /></UiProvider>);

  it("server-renders five meaningful stills with no running motion", () => {
    const markup = html();
    expect(markup.match(/<article /g)).toHaveLength(5);
    for (const name of sceneNames) {
      expect(markup).toContain(`data-bento-card="${name}" data-phase="${staticScenePhases[name]}" data-running="false"`);
    }
    expect(markup).not.toContain("<button");
    expect(markup).not.toMatch(/Replay|Reload|Pause illustrations|Motion off|not live gameplay|not a completed sale/);
  });

  it("uses the existing official ecosystem artwork", () => {
    const markup = html();
    for (const filename of ["solana.svg", "magicblock.svg", "raydium.png", "usdc.svg"]) {
      expect(markup).toContain(`/brand/ecosystem/${filename}`);
    }
    expect(markup).not.toMatch(/(?:src|href)="https?:\/\//);
  });

  it("keeps illustrative state distinct from actual gameplay and settlement", () => {
    const content = html().replace(/<[^>]*>/g, "");
    for (const text of ["Sell intents share a 2-second window", "tokens stay on Solana",
      "After a confirmed swap", "transfer confirms", "Up to 0.25%", "No game penalty", "not to scale"]) {
      expect(content).toContain(text);
    }
    expect(content).not.toMatch(/guaranteed|instant payout|APR|APY|Connect wallet/i);
  });

  it("does not import wallet, market, routing or transaction services", () => {
    const directory = new URL("../src/features/landing/bento/", import.meta.url);
    for (const filename of readdirSync(directory).filter(name => /\.tsx?$/.test(name))) {
      const source = readFileSync(new URL(filename, directory), "utf8");
      expect(source).not.toMatch(/@solana\/|@magicblock-labs\/|@flinch\/client|WalletProvider|MarketProvider|webConfig|fetch\(|WebSocket|localStorage/);
    }
  });

  it.each([0, 1, 2, 3])("keeps base custody separate from the moving control ticket in phase %s", phase => {
    const markup = renderToStaticMarkup(<RollupScene phase={phase} transition={() => ({ duration: 0 })} />);
    expect(markup).toContain(`data-rollup-step="${phase}"`);
    expect(markup).toContain('data-rollup-packet=""');
    expect(markup).toContain('data-rollup-custody=""');
    expect(markup).toContain("Token custody");
    expect(markup).toContain("Control account");
    expect(markup).toContain("Return");
    expect(markup.match(/data-rollup-intent=/g)).toHaveLength(3);
    expect(markup).not.toMatch(/confirmed|completed|signature|balance/i);
  });

  it.each([0, 1, 2, 3])("keeps the asset stationary and four seats visible in phase %s", phase => {
    const markup = renderToStaticMarkup(<CustodyScene phase={phase} transition={() => ({ duration: 0 })} />);
    expect(markup.match(/data-stake-seat=/g)).toHaveLength(4);
    expect(markup.match(/WSOL/g)).toHaveLength(1);
    expect(markup).toContain("Same amount.");
    expect(markup).toContain("On Solana");
    expect(markup.match(/data-stake-chip=/g)).toHaveLength(4);
    expect(markup).not.toMatch(/Your table|data-stake-ticket|rotate/);
  });
});
