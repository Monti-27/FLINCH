import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { Button } from "../src/components/ui/button.tsx";
import { Footer } from "../src/components/shell/footer.tsx";
import { ShaderBackground } from "../src/components/ui/adisyon-shader.tsx";
import { NavigationContent, protocolLinks } from "../src/components/shell/navigation-content.tsx";
import { UiProvider } from "../src/providers/ui-provider.tsx";
import { createUiStore } from "../src/stores/ui-store.ts";

it("uses a native non-submit raised button with disabled and accessible states", () => {
  const markup = renderToStaticMarkup(<Button disabled aria-busy="true" className="example">Connect wallet</Button>);
  expect(markup).toContain('type="button"');
  expect(markup).toContain('disabled=""');
  expect(markup).toContain('aria-busy="true"');
  expect(markup).toContain('class="button primary button-default example"');
  expect(markup).not.toContain("canvas");
  expect(markup).toContain("Connect wallet");
});

it("keeps navigation preferences provider-scoped", () => {
  const store = createUiStore();
  store.getState().setMobileNavigation(true);
  store.getState().setNavigationPanel("game");
  expect(store.getState()).toMatchObject({ mobileNavigation: true, navigationPanel: "game" });
  expect(createUiStore().getState()).toMatchObject({ mobileNavigation: false, navigationPanel: null });
});

it("closes every navigation panel across breakpoints and room changes", () => {
  const store = createUiStore();
  store.getState().setMobileNavigation(true);
  store.getState().setNavigationPanel("protocol");
  store.getState().setCompactPlayers(false);
  expect(store.getState()).toMatchObject({ mobileNavigation: false, navigationPanel: null });
  store.getState().setNavigationPanel("game");
  store.getState().setRoom("room-a");
  expect(store.getState().navigationPanel).toBeNull();
  store.getState().setNavigationPanel("protocol");
  store.getState().closeNavigation();
  store.getState().closeNavigation();
  expect(store.getState()).toMatchObject({ mobileNavigation: false, navigationPanel: null });
});

it("clears panel state when the mobile menu is toggled", () => {
  const store = createUiStore();
  store.getState().setNavigationPanel("game");
  store.getState().setMobileNavigation(false);
  expect(store.getState().navigationPanel).toBeNull();
});

it("only links protocol resources to their actual documentation", () => {
  const markup = renderToStaticMarkup(<NavigationContent panel="protocol" />);
  for (const link of protocolLinks) expect(markup).toContain(`href="${link.href}"`);
  expect(markup.match(/rel="noreferrer"/g)).toHaveLength(3);
  expect(markup).not.toContain('href="#"');
  expect(markup).toContain("Only a confirmed Solana swap completes a sale");
});

it("distinguishes a read-only Devnet preview from an undeployed program", () => {
  const markup = renderToStaticMarkup(<UiProvider><Footer config={{ network: "devnet", transactions: false }} /></UiProvider>);
  expect(markup).toContain("Read-only preview. Transactions are disabled.");
  expect(markup).toContain("Solana Devnet");
  expect(markup).toContain("Devnet SOL and USDC have no monetary value");
  expect(markup).not.toContain("not deployed");
  expect(markup).toContain("No real-money wagering");
  expect(markup).toContain("Reference prices are not sell quotes");
  expect(markup).toContain("Back to arena");
  expect(markup).toContain('aria-label="Protocol documentation"');
  expect(markup).toContain('class="footer-notice"');
  expect(markup).toContain('class="footer-hands"');
  expect(markup).toContain('class="footer-hand footer-hand-left"');
  expect(markup).toContain('class="footer-hand footer-hand-right"');
  expect(markup).toContain('data-theme="dark"');
  expect(markup).toContain('data-layout="arena"');
  expect(markup.match(/<canvas/g)).toHaveLength(2);
  expect(markup).not.toMatch(/Pause motion|Resume motion|Hold your nerve/);
  expect(markup).toContain('<details class="footer-notice">');
  expect(markup).toContain('class="footer-lockup"');
  expect(markup).toContain("MagicBlock");
  expect(markup).not.toContain("Instagram");
});

it("renders a decorative server-safe canvas without taking keyboard focus", () => {
  const markup = renderToStaticMarkup(<ShaderBackground paused className="footer-shader" />);
  expect(markup).toContain("<canvas");
  expect(markup).toContain('aria-hidden="true"');
  expect(markup).toContain('data-state="loading"');
  expect(markup).not.toContain("tabindex");
});

it("keeps manual motion preferences scoped and separate from system motion", () => {
  const store = createUiStore();
  store.getState().setAmbientMotionPaused(true);
  store.getState().setReducedMotion(false);
  expect(store.getState().ambientMotionPaused).toBe(true);
  expect(createUiStore().getState().ambientMotionPaused).toBe(false);
});

it("does not call local test execution a public deployment", () => {
  const markup = renderToStaticMarkup(<UiProvider><Footer config={{ network: "localnet", transactions: true }} /></UiProvider>);
  expect(markup).toContain("Localnet / Network details");
  expect(markup).toContain("separate local sandbox, not public Devnet");
  expect(markup).toContain("Experimental build. Test tokens only");
  expect(markup).not.toContain("Solana Devnet");
});

it("keeps the landing footer spacious in either theme", () => {
  for (const theme of ["light", "dark"] as const) {
    const markup = renderToStaticMarkup(<UiProvider><Footer config={{ network: "devnet", transactions: false }} arenaHref="/play" theme={theme} /></UiProvider>);
    expect(markup).toContain('data-layout="landing"');
    expect(markup).toContain(`data-theme="${theme}"`);
    expect(markup).toContain("Enter the arena");
  }
});

it.each([
  ["devnet", false, "Solana Devnet"],
  ["devnet", true, "Solana Devnet"],
  ["localnet", false, "Localnet"],
  ["localnet", true, "Localnet"],
] as const)("keeps %s identity separate from transaction enablement %s", (network, transactions, label) => {
  const markup = renderToStaticMarkup(<UiProvider><Footer config={{ network, transactions }} /></UiProvider>);
  expect(markup).toContain(`<summary>${label} / Network details</summary>`);
  expect(markup.includes("Transactions are disabled")).toBe(!transactions);
  expect(markup.includes("Experimental build. Test tokens only.")).toBe(transactions);
  expect(markup).toContain("no monetary value");
  expect(markup).not.toMatch(/Testnet|not deployed yet/);
});
