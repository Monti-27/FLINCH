import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { Standoff } from "../src/features/match/standoff.tsx";
import { UiProvider } from "../src/providers/ui-provider.tsx";
import { snapshot, control } from "../../../tests/keeper/fixtures.ts";
import type { BaseRoom, Control } from "@flinch/client";

function render(room?: BaseRoom, remaining?: bigint, state?: Control) {
  return renderToStaticMarkup(<UiProvider><Standoff room={room} remaining={remaining} control={state} seat={room ? 0 : -1} /></UiProvider>);
}

it("shows empty membership and a duration, not a running or funded game", () => {
  const markup = render();
  expect(markup).toContain("Who sells first?");
  expect(markup).not.toContain("Round in progress");
  expect(markup).toContain("Round duration, 90 seconds");
  expect(markup).toContain('data-seconds="90"');
  expect(markup).toContain("0 / 4 seats filled");
  expect(markup).not.toContain("Holding WSOL");
});

it("shows actual membership and an explicitly estimated bounded clock", () => {
  const markup = render(snapshot(), 65n);
  expect(markup).toContain("4 / 4 seats filled");
  expect(markup).toContain("Round in progress");
  expect(markup).toContain("Estimated time left, 65 seconds");
  expect(markup).toContain('data-seconds="65"');
  expect(render(snapshot(), -4n)).toContain('data-seconds="0"');
  expect(render(snapshot(), 150n)).toContain('data-seconds="90"');
});

it("keeps queued exposure distinct from a confirmed exit", () => {
  const room = snapshot();
  const markup = render(room, 60n, control(room));
  expect(markup).toContain("SELL queued");
  expect(markup).toContain("WSOL has not sold yet");
  expect(markup).not.toContain("USDC claimable");
});

it("ends the clock for a cancelled room even without economics", () => {
  const room = snapshot();
  const markup = render({ ...room, ledger: { ...room.ledger, phase: "cancelled", economics: null } });
  expect(markup).toContain("Round ended");
  expect(markup).toContain("END");
  expect(markup).not.toContain('data-seconds="90"');
});

it("derives the radial bars from the bounded clock without inventing progress", () => {
  expect(render().match(/opacity:1/g)).toHaveLength(72);
  expect(render(snapshot(), 45n).match(/opacity:1/g)).toHaveLength(36);
  expect(render(snapshot(), 0n).match(/opacity:0/g)).toHaveLength(72);
  const room = snapshot();
  expect(render({ ...room, ledger: { ...room.ledger, phase: "cancelled" } }).match(/opacity:0/g)).toHaveLength(72);
});

it("labels a stale room clock as an estimate rather than a synchronized timer", () => {
  const markup = renderToStaticMarkup(<UiProvider><Standoff room={snapshot()} remaining={30n} stale /></UiProvider>);
  expect(markup).toContain('data-state="stale"');
  expect(markup).toContain("Estimate · stale");
});

it("keeps the funding dial full even when a stale remaining estimate is supplied", () => {
  const room = snapshot();
  const markup = render({ ...room, ledger: { ...room.ledger, phase: "funding", economics: null } }, 3n);
  expect(markup).toContain('data-state="ready"');
  expect(markup).toContain('data-seconds="90"');
  expect(markup.match(/opacity:1/g)).toHaveLength(72);
});

it("uses fractional seconds for the dial and rounds the visible seconds up", () => {
  const markup = renderToStaticMarkup(<UiProvider><Standoff room={snapshot()} remainingMs={44_250n} /></UiProvider>);
  expect(markup).toContain('data-seconds="45"');
  expect(markup).toContain('data-remaining-ms="44250"');
  expect(markup).toContain('role="timer"');
  expect(markup).toContain('aria-live="off"');
});

it("does not claim settlement when the countdown reaches zero", () => {
  const markup = render(snapshot(), 0n);
  expect(markup).toContain('data-state="urgent"');
  expect(markup).not.toContain("Round ended");
  expect(markup).not.toContain(">END<");
});
