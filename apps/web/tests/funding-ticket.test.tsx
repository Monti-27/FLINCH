import { renderToStaticMarkup } from "react-dom/server";
import { PublicKey } from "@solana/web3.js";
import { expect, it } from "vitest";
import type { FlinchClient } from "@flinch/client";
import { snapshot, signer } from "../../../tests/keeper/fixtures.ts";
import { Funding } from "../src/features/lobby/funding.tsx";
import { FundingTicket } from "../src/features/lobby/funding-ticket.tsx";

const base = { stake: 1_000_001n, joined: false, seat: -1, occupied: 1, expired: false, disabled: false,
  busy: false, useSession: true, setUseSession: () => {}, onJoin: () => {} };

it("shows an exact equal deposit and explicit limited session permission before joining", () => {
  const html = renderToStaticMarkup(<FundingTicket {...base} />);
  expect(html).toContain("Take your seat");
  expect(html).toContain("0.001000001");
  expect(html).toContain('aria-label="Join · 0.001000001 SOL"');
  expect(html).toContain("Deposit and seat are confirmed together on Solana");
  expect(html).toContain("cannot move your wallet tokens or claim");
  expect(html).toContain("0.0001 SOL");
  expect(html).not.toContain("Deposited");
});

it("replaces join controls with the confirmed seat and stake", () => {
  const html = renderToStaticMarkup(<FundingTicket {...base} joined seat={1} occupied={2} />);
  for (const text of ["You’re in", "Waiting for 2 more players.", "Your stake", "Deposited", "WSOL", "Player 2", "2 of 4"]) expect(html).toContain(text);
  expect(html).not.toContain("Join round");
  expect(html).not.toContain('type="checkbox"');
});

it("does not offer join or session setup for full or expired rooms", () => {
  for (const overrides of [{ occupied: 4 }, { expired: true }]) {
    const html = renderToStaticMarkup(<FundingTicket {...base} {...overrides} />);
    expect(html).not.toContain("Join round");
    expect(html).not.toContain('type="checkbox"');
    expect(html).not.toContain("You’re in");
  }
});

it("preserves disabled and busy controls without implying a confirmed deposit", () => {
  const html = renderToStaticMarkup(<FundingTicket {...base} busy disabled />);
  expect(html.match(/disabled=""/g)).toHaveLength(2);
  expect(html).toContain('aria-busy="true"');
  expect(html).not.toContain("Deposited");
});

it("keeps room and session management quiet without duplicating the non-funding heading", () => {
  const initial = snapshot();
  const room = { ...initial, ledger: { ...initial.ledger, phase: "funding" as const, economics: null,
    wallets: [signer.publicKey, PublicKey.default, PublicKey.default, PublicKey.default] as typeof initial.ledger.wallets } };
  const props = { client: {} as FlinchClient, signer, remember: () => {}, busy: false, enabled: true, run: async () => undefined };
  const html = renderToStaticMarkup(<Funding {...props} room={room} />);
  expect(html).toContain("You’re in");
  expect(html).toContain("Cancel room");
  expect(html).toContain("Revoke SELL session");
  expect(html).toContain('aria-label="Stop session and request revocation"');
  expect(html).not.toContain("Join this round");
  expect(html).not.toContain("<details open");
  const closed = renderToStaticMarkup(<Funding {...props} room={{ ...room, ledger: { ...room.ledger, phase: "cancelled" } }} />);
  expect(closed).not.toContain("<h2");
  expect(closed).not.toContain("Cancel room");
  expect(closed).toContain("Revoke SELL session");
});
