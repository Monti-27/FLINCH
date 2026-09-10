import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { SegmentedControl } from "../src/components/ui/segmented-control.tsx";
import { TokenAmountInput } from "../src/components/ui/token-amount-input.tsx";
import { Button } from "../src/components/ui/button.tsx";
import { createUiStore } from "../src/stores/ui-store.ts";

it("renders selectors as labeled buttons without implicit form submission", () => {
  const markup = renderToStaticMarkup(<SegmentedControl label="View" value="one" onChange={() => {}}
    options={[{ value: "one", label: "First" }, { value: "two", label: "Second" }]} />);
  expect(markup).toContain('role="group"');
  expect(markup).toContain('aria-label="View"');
  expect(markup.match(/type="button"/g)).toHaveLength(2);
  expect(markup.match(/aria-pressed="true"/g)).toHaveLength(1);
});

it("keeps token amounts as exact strings with labeled decimal input", () => {
  const markup = renderToStaticMarkup(<TokenAmountInput id="test-amount" label="Your stake" symbol="SOL"
    value="0.000000001" onChange={() => {}} aria-describedby="test-hint" />);
  expect(markup).toContain('for="test-amount"');
  expect(markup).toContain('value="0.000000001"');
  expect(markup).toContain('inputMode="decimal"');
  expect(markup).toContain('type="text"');
  expect(markup).toContain('aria-describedby="test-hint"');
});

it("isolates entry modes while preserving the user's draft", () => {
  const store = createUiStore();
  store.getState().setStake("0.005");
  store.getState().setInvite("room-code");
  store.getState().setLobbyMode("join");
  store.getState().setLobbyMode("create");
  expect(store.getState()).toMatchObject({ stake: "0.005", invite: "room-code", lobbyMode: "create" });
  expect(createUiStore().getState().invite).toBe("");
});

it("keeps loading actions disabled with their original label", () => {
  const markup = renderToStaticMarkup(<Button isLoading>Queue SELL</Button>);
  expect(markup).toContain('disabled=""');
  expect(markup).toContain('aria-busy="true"');
  expect(markup).toContain("Queue SELL");
});

it.each(["inset", "keys", "tabs"] as const)("keeps %s selectors controlled and non-submitting", appearance => {
  const markup = renderToStaticMarkup(<SegmentedControl label="Room entry" appearance={appearance} value="one" onChange={() => {}}
    options={[{ value: "one", label: "First" }, { value: "two", label: "Second" }]} />);
  expect(markup).toContain(`data-appearance="${appearance}"`);
  expect(markup.match(/type="button"/g)).toHaveLength(2);
  expect(markup.match(/aria-pressed="true"/g)).toHaveLength(1);
});

it("requires an explicit submit type for shared actions", () => {
  expect(renderToStaticMarkup(<Button>Quote</Button>)).toContain('type="button"');
  expect(renderToStaticMarkup(<Button type="submit">Create room</Button>)).toContain('type="submit"');
});
