import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { quoteSell } from "@flinch/client";
import { control, snapshot } from "../../../tests/keeper/fixtures.ts";
import { SellTicket } from "../src/features/match/sell-ticket.tsx";

const base = { holding: 1_000_001n, fresh: false, sessionReady: false, loading: false, busy: false,
  canQuote: true, canQueue: true, onQuote: () => {}, onQueue: () => {} };

function quote() {
  const room = snapshot();
  return quoteSell({ pool: room.ledger.pool, slot: 50, chainTime: 101n, receivedAtMs: 1000,
    inputReserve: 100_000_000_000n, outputReserve: 20_000_000_000n, tradeFeeRate: 2500n,
    creatorFeeRate: 0n, fundFeeRate: 0n, protocolFeeRate: 0n, creatorFeeOnInput: true }, { ...control(room), sellers: 0 }, 0, 101n, 100, 1000);
}

it("shows exact confirmed WSOL and official token identities without inventing a USDC estimate", () => {
  const html = renderToStaticMarkup(<SellTicket {...base} />);
  expect(html).toContain("0.001000001");
  expect(html).toContain("/brand/ecosystem/solana.svg");
  expect(html).toContain("/brand/ecosystem/usdc.svg");
  expect(html).toContain("Test USDC");
  expect(html).not.toContain("Estimated proceeds");
  expect(html).not.toContain("Queue SELL");
});

it("keeps the signed minimum visible, separates fees and disables an expired queue action", () => {
  const html = renderToStaticMarkup(<SellTicket {...base} quote={quote()} quoteIssue="Quote cohort closed" />);
  expect(html).toContain("Your signed minimum");
  expect(html).toContain("Estimated proceeds · Raydium");
  expect(html).toMatch(/disabled=""[^>]*>Queue SELL/);
  expect(html).toContain("Quote cohort closed");
  expect(html).toContain("Refresh quote");
  expect(html).toContain("Maximum game penalty");
  expect(html).not.toContain("<details open");
});

it("a fresh quote still cannot bypass deployment or busy guards", () => {
  for (const overrides of [{ canQueue: false }, { busy: true }]) {
    const html = renderToStaticMarkup(<SellTicket {...base} {...overrides} quote={quote()} fresh />);
    expect(html).toMatch(/disabled=""[^>]*>Queue SELL/);
  }
});

it("shows a quote-shaped placeholder only during the actual reserve read", () => {
  const html = renderToStaticMarkup(<SellTicket {...base} loading />);
  expect(html).toContain('aria-label="Reading pool reserves"');
  expect(html).toContain('data-skeleton=""');
  expect(html).toContain("0.001000001");
  expect(html).not.toContain("Queue SELL");
  expect(html).not.toContain("Estimated proceeds");
  expect(renderToStaticMarkup(<SellTicket {...base} />)).not.toContain("data-skeleton");
});
