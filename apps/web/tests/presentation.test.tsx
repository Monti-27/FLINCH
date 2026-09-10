import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { TransactionStatus } from "../src/features/proof/transaction-status.tsx";
import { Roster } from "../src/features/match/roster.tsx";
import { RoomSidebar } from "../src/components/shell/room-sidebar.tsx";
import { UiProvider } from "../src/providers/ui-provider.tsx";
import { Claims } from "../src/features/claims/claims.tsx";
import { Sell } from "../src/features/match/sell.tsx";
import { snapshot, control } from "../../../tests/keeper/fixtures.ts";
import { DEVNET_GENESIS } from "@flinch/client";
import type { BaseRoom, FlinchClient } from "@flinch/client";

it("does not render empty transaction furniture", () => {
  expect(renderToStaticMarkup(<TransactionStatus busy={false} network="devnet" />)).toBe("");
});

it("leaves wallet prompts and cancellations to Sonner before a transaction exists", () => {
  expect(renderToStaticMarkup(<TransactionStatus busy network="devnet" />)).toBe("");
});

it("shows four honest empty seats without fabricated positions", () => {
  const markup = renderToStaticMarkup(<Roster />);
  expect(markup.match(/class="player-slot"/g)).toHaveLength(4);
  expect(markup).toContain("0 of 4 seats filled");
  expect(markup).not.toContain("USDC claimable");
  expect(markup).not.toContain("seat-avatar");
});

it("starts the player rail collapsed with an explicit rules control", () => {
  const markup = renderToStaticMarkup(<UiProvider><RoomSidebar /></UiProvider>);
  expect(markup).toContain('aria-label="Players and round rules"');
  expect(markup).toContain("How the round works");
  expect(markup).toContain('data-expanded="false"');
  expect(markup).toContain('inert=""');
  expect(markup.match(/class="player-slot"/g)).toHaveLength(4);
  expect(markup).not.toContain("Volume");
});

it("renders occupied seats from the ledger without offering seat selection", () => {
  const markup = renderToStaticMarkup(<Roster room={snapshot()} seat={0} />);
  expect(markup.match(/<article/g)).toHaveLength(4);
  expect(markup).not.toContain('class="player-slot"');
  expect(markup).toContain("4 of 4 seats filled");
  expect(markup).toContain("You");
});

function renderClaims(room: BaseRoom, seat = 0) {
  return renderToStaticMarkup(<Claims client={{ config: { expectedGenesis: DEVNET_GENESIS } } as FlinchClient}
    room={room} seat={seat} busy={false} enabled={false} run={async () => undefined} />);
}

it("omits empty withdrawal controls during a live position", () => {
  expect(renderClaims(snapshot())).toBe("");
});

it("shows a confirmed USDC entitlement without waiting for the round to end", () => {
  const room = snapshot();
  const settled = { ...room, ledger: { ...room.ledger, economics: { ...room.ledger.economics!, usdcClaims: [1n, 0n, 0n, 0n] as const } } };
  expect(renderClaims(settled)).toContain("0.000001");
  expect(renderClaims(settled)).toContain("Claim USDC");
});

it("keeps permissionless recovery visible even for a spectator", () => {
  expect(renderClaims(snapshot(220n), -1)).toContain("Recover round");
  expect(renderClaims(snapshot(220n), -1)).not.toContain("Claim WSOL");
});

it("only renders asset rows that have a real claimable entitlement", () => {
  const room = snapshot();
  const settled = { ...room, ledger: { ...room.ledger, economics: { ...room.ledger.economics!, usdcClaims: [1n, 0n, 0n, 0n] as const } } };
  expect(renderClaims(settled)).toContain("Claim USDC");
  expect(renderClaims(settled)).not.toContain("Claim WSOL");
});

it("replaces completed withdrawal controls with a concise confirmed state", () => {
  const room = snapshot();
  const claimed = { ...room, ledger: { ...room.ledger, economics: { ...room.ledger.economics!, terminalTag: 1,
    holdings: [0n, 0n, 0n, 0n] as const } } };
  expect(renderClaims(claimed)).toContain("Withdrawals complete");
  expect(renderClaims(claimed)).not.toContain("<button");
});

it("distinguishes an observed queued intent from a confirmed exit", () => {
  const room = snapshot();
  const queued = renderToStaticMarkup(<Sell client={{} as FlinchClient} room={room} control={control(room)} seat={0}
    busy={false} enabled={false} wallTime={0} run={async () => undefined} />);
  expect(queued).toContain("Sell queued");
  expect(queued).not.toContain("Exit confirmed");
  const settled = { ...room, ledger: { ...room.ledger, economics: { ...room.ledger.economics!, holdings: [0n, 1n, 1n, 1n] as const } } };
  const confirmed = renderToStaticMarkup(<Sell client={{} as FlinchClient} room={settled} seat={0}
    busy={false} enabled={false} wallTime={0} run={async () => undefined} />);
  expect(confirmed).toContain("Exit confirmed");
  expect(confirmed).not.toContain("Get sell quote");
});
