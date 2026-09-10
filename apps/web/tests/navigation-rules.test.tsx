import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HelpContent } from "../src/components/shell/help-content.tsx";
import { HelpDialog } from "../src/components/shell/help-dialog.tsx";
import { NavigationContent } from "../src/components/shell/navigation-content.tsx";
import { UiProvider } from "../src/providers/ui-provider.tsx";
import { createUiStore } from "../src/stores/ui-store.ts";

describe("navigation and rules presentation", () => {
  it("renders a compact rules section without modal furniture", () => {
    const html = renderToStaticMarkup(<NavigationContent panel="rules" />);
    expect(html.match(/<li>/g)).toHaveLength(3);
    expect(html).toContain("90-second round");
    expect(html).toContain("0.25%");
    expect(html).toContain("outside their batch");
    expect(html).toContain("even at timeout");
    expect(html).toContain("Failed or expired swaps charge no game penalty");
    expect(html).not.toMatch(/<dialog|rules-facts|Got it|Ready when you are/);
  });

  it("routes arena rules shortcuts into the shared navigation without a modal", () => {
    const store = createUiStore();
    store.getState().openNavigationRules();
    expect(store.getState()).toMatchObject({ navigationPanel: "rules", mobileNavigation: true, helpOpen: false });
    store.getState().setCompactPlayers(false);
    store.getState().openNavigationRules();
    expect(store.getState()).toMatchObject({ navigationPanel: "rules", mobileNavigation: false, helpOpen: false });
    store.getState().setNavigationPanel("protocol");
    expect(store.getState().navigationPanel).toBe("protocol");
    store.getState().closeNavigation();
    expect(store.getState().navigationPanel).toBeNull();
  });
  it("keeps the game menu concise without repeating the network disclosure", () => {
    const html = renderToStaticMarkup(<NavigationContent panel="game" />);
    expect(html.match(/<li>/g)).toHaveLength(3);
    expect(html).toContain("confirmed sale");
    expect(html).not.toMatch(/Test tokens only|No protocol fee|Built on|Powered by/);
  });

  it("groups four rules separately from round facts", () => {
    const html = renderToStaticMarkup(<HelpContent />);
    expect(html.match(/<li>/g)).toHaveLength(4);
    expect(html.match(/<h3>/g)).toHaveLength(4);
    expect(html).toContain('aria-label="Round at a glance"');
    expect(html).toContain("0.001–0.01 test SOL");
    expect(html).toContain("0.25%");
  });

  it("keeps settlement and failure limits visible outside the disclosure", () => {
    const html = renderToStaticMarkup(<HelpContent />).split("<details")[0];
    expect(html).toContain("only after the Solana swap confirms");
    expect(html).toContain("failed or expired swap charges no game penalty");
    expect(html).toContain("several holders at timeout, each keeps their share");
  });

  it("retains cohort exceptions, recovery and fee details in a native disclosure", () => {
    const html = renderToStaticMarkup(<HelpContent />);
    expect(html).toContain('<details class="rules-details"><summary>');
    expect(html).toContain("same batch never pay each other");
    expect(html).toContain("the penalty is zero");
    expect(html).toContain("30 seconds after the round ends");
    expect(html).toContain("Reference prices are not executable quotes");
    expect(html).toContain("Network fees, DEX fees and account rent are separate");
  });

  it("uses a labelled native modal with close and confirmation controls", () => {
    const html = renderToStaticMarkup(<UiProvider><HelpDialog /></UiProvider>);
    expect(html).toContain("<dialog");
    expect(html).toContain('aria-labelledby="help-title"');
    expect(html).toContain('aria-describedby="help-description"');
    expect(html).toContain('aria-label="Close rules"');
    expect(html).toContain("Got it");
    expect(html).not.toContain("Experimental test-token build");
  });
});
