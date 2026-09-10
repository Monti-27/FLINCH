import { renderToStaticMarkup } from "react-dom/server";
import { PublicKey } from "@solana/web3.js";
import { expect, it, vi } from "vitest";
import { DEVNET_GENESIS } from "@flinch/client";
import type { BaseRoom, FlinchClient } from "@flinch/client";
import { snapshot, signer } from "../../../tests/keeper/fixtures.ts";
import { pendingWithdrawal, withdrawalState } from "../src/features/claims/withdrawal-state.ts";
import { WithdrawalDetails, WithdrawalTicket } from "../src/features/claims/withdrawal-ticket.tsx";
import { Claims } from "../src/features/claims/claims.tsx";
import { createClaimActionStore } from "../src/stores/claim-action-store.ts";
import type { Operation } from "../src/lib/operation.ts";

const client = { config: { expectedGenesis: DEVNET_GENESIS } } as FlinchClient;
function sold() {
  return economics(snapshot(), { holdings: [0n, 1_000_000n, 1_000_000n, 1_000_000n], usdcClaims: [105_321n, 0n, 0n, 0n] });
}
function economics(room: BaseRoom, overrides: Partial<NonNullable<BaseRoom["ledger"]["economics"]>>): BaseRoom {
  return { ...room, ledger: { ...room.ledger, economics: { ...room.ledger.economics!, ...overrides } } };
}
function operation(room = sold(), overrides: Partial<Operation> = {}): Operation {
  return { version: 1, wallet: signer.publicKey.toBase58(), genesis: DEVNET_GENESIS, room: room.ledger.address.toBase58(),
    action: "Claim USDC", signature: "not-sent", runtime: "base", endpoint: "http://127.0.0.1:8899", status: "pending", ...overrides };
}

it("keeps unsold WSOL out of withdrawals and does not replace the live ticket", () => {
  expect(withdrawalState(snapshot(), 0)).toMatchObject({ visible: false, replacesPosition: false, recovery: false, withdrawals: [] });
});

it("replaces a confirmed sale with its exact USDC claim before the round ends", () => {
  expect(withdrawalState(sold(), 0)).toMatchObject({ visible: true, replacesPosition: true, closed: false,
    context: "Exit confirmed on Solana", withdrawals: [{ asset: "usdc", amount: 105_321n }] });
});

it("keeps a closed position visible after claiming during the live round", () => {
  const room = economics(sold(), { usdcClaims: [0n, 0n, 0n, 0n] });
  expect(withdrawalState(room, 0)).toMatchObject({ visible: true, replacesPosition: true, closed: true, withdrawals: [] });
});

it("releases the exact holder entitlement only after the base terminal state", () => {
  const room = economics(snapshot(), { holdings: [1_005_007n, 1_000_000n, 1_000_000n, 1_000_000n] });
  expect(withdrawalState(room, 0).withdrawals).toEqual([]);
  expect(withdrawalState(economics(room, { terminalTag: 1 }), 0).withdrawals).toEqual([{ asset: "wsol", amount: 1_005_007n }]);
});

it("shows exact cancelled-room refunds but never an unfunded seat or spectator refund", () => {
  const initial = snapshot();
  const room: BaseRoom = { ...initial, ledger: { ...initial.ledger, phase: "cancelled", economics: null,
    wallets: [initial.ledger.wallets[0], PublicKey.default, initial.ledger.wallets[2], initial.ledger.wallets[3]] } };
  expect(withdrawalState(room, 0).withdrawals).toEqual([{ asset: "wsol", amount: room.ledger.stake }]);
  for (const seat of [-1, 4, 0.5, NaN]) expect(withdrawalState(room, seat).visible).toBe(false);
  expect(withdrawalState(room, 1).visible).toBe(false);
  expect(withdrawalState({ ...room, ledger: { ...room.ledger, refunded: [true, false, false, false] } }, 0)).toMatchObject({ closed: true, withdrawals: [] });
});

it("offers permissionless recovery at the actual base cutoff without inventing a released balance", () => {
  expect(withdrawalState(snapshot(219n), -1).visible).toBe(false);
  for (const seat of [0, -1]) expect(withdrawalState(snapshot(220n), seat)).toMatchObject({ visible: true, recovery: true, replacesPosition: true, withdrawals: [] });
  const room = { ...sold(), now: 220n };
  expect(withdrawalState(room, 0)).toMatchObject({ recovery: true, withdrawals: [{ asset: "usdc", amount: 105_321n }] });
});

it("scopes pending feedback to the wallet, network, room and base runtime", () => {
  const room = sold();
  const op = operation(room);
  const pending = (value: Operation) => pendingWithdrawal(value, room, signer.publicKey.toBase58(), DEVNET_GENESIS);
  expect(pending(op)).toEqual({ claim: true, recovery: false });
  for (const change of [{ wallet: PublicKey.default.toBase58() }, { room: PublicKey.default.toBase58() },
    { genesis: PublicKey.default.toBase58() }, { runtime: "er" as const }, { status: "confirmed" as const },
    { status: "failed" as const }, { status: "not_sent" as const }]) expect(pending({ ...op, ...change })).toEqual({ claim: false, recovery: false });
  expect(pending({ ...op, action: "Recover round" })).toEqual({ claim: false, recovery: true });
});

it("does not let an uncertain base claim hide or disable separately journaled recovery", () => {
  const room = { ...sold(), now: 220n };
  const html = renderToStaticMarkup(<Claims client={client} room={room} seat={0} signer={signer} enabled busy={false}
    operation={operation(room)} run={async () => undefined} />);
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[\s\S]*?Claim USDC/);
  expect(html).toMatch(/<button(?![^>]*disabled)[^>]*>Recover round<\/button>/);
  expect(html).toContain("Unconfirmed. Use Check transaction before trying again.");
  expect(html).not.toContain("Withdrawals complete");
});

it.each(["wsol", "usdc"] as const)("renders a primary %s claim with its full smallest unit", asset => {
  const html = renderToStaticMarkup(<WithdrawalTicket withdrawal={{ asset, amount: 1n }} refund={false}
    disabled={false} loading={false} pending={false} onClaim={() => {}} />);
  expect(html).toContain(asset === "wsol" ? "0.000000001" : "0.000001");
  expect(html).toContain(`aria-label="${asset.toUpperCase()} withdrawal"`);
  expect(html).toContain("button primary button-lg");
  expect(html).toContain('type="button"');
  expect(html).not.toContain("disabled");
});

it("keeps signed and pending states distinct from completed withdrawals", () => {
  const html = renderToStaticMarkup(<WithdrawalTicket withdrawal={{ asset: "usdc", amount: 10n }} refund={false}
    disabled loading pending={false} onClaim={() => {}} />);
  expect(html).toContain('aria-busy="true"');
  expect(html).toContain("Waiting for wallet and Solana confirmation");
  expect(html).not.toContain("complete");
  const details = renderToStaticMarkup(<WithdrawalDetails wrapped />);
  expect(details).toContain("<details");
  expect(details).not.toContain("open=");
  expect(details).toContain("WSOL stays wrapped");
});

it("locks duplicate claim actions before any instruction building or signing", async () => {
  const store = createClaimActionStore();
  let finish!: () => void;
  const perform = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
  const onError = vi.fn();
  const first = store.getState().execute("usdc", perform, onError);
  expect(store.getState().action).toBe("usdc");
  await store.getState().execute("usdc", perform, onError);
  await store.getState().execute("recover", perform, onError);
  expect(perform).toHaveBeenCalledTimes(1);
  finish(); await first;
  expect(store.getState()).toMatchObject({ action: undefined });
  expect(onError).not.toHaveBeenCalled();
  expect(store.getState()).not.toHaveProperty("confirmed");
});

it("reports failures and cancellations once without storing inline error text", async () => {
  const store = createClaimActionStore();
  const onError = vi.fn();
  await store.getState().execute("wsol", async () => { throw new Error("Network unavailable"); }, onError);
  expect(onError).toHaveBeenCalledExactlyOnceWith(new Error("Network unavailable"));
  await store.getState().execute("wsol", async () => {
    throw new Error("User rejected the wallet request");
  }, onError);
  expect(onError).toHaveBeenCalledTimes(2);
  expect(onError).toHaveBeenLastCalledWith(new Error("User rejected the wallet request"));
  expect(store.getState().action).toBeUndefined();
  expect(store.getState()).not.toHaveProperty("error");
});

it("keeps late results in the original room and wallet store", async () => {
  const old = createClaimActionStore();
  const current = createClaimActionStore();
  let fail!: (value: Error) => void;
  const onError = vi.fn();
  const first = old.getState().execute("usdc", () => new Promise((_, reject) => { fail = reject; }), onError);
  fail(new Error("Old wallet error")); await first;
  expect(onError).toHaveBeenCalledExactlyOnceWith(new Error("Old wallet error"));
  expect(current.getState().action).toBeUndefined();
  expect(current.getState()).not.toHaveProperty("error");
});
