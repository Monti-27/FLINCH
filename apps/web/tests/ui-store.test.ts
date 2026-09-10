import { expect, it } from "vitest";
import { createUiStore } from "../src/stores/ui-store.ts";
import { createTransactionStore } from "../src/stores/transaction-store.ts";
import { operationNotification } from "../src/lib/notifications.ts";

it("keeps user preferences isolated between providers", () => {
  const first = createUiStore();
  const second = createUiStore();
  first.getState().setRoom("room-a");
  first.getState().setStake("0.005");
  first.getState().setInterval(300);
  first.getState().setChartStyle("line");
  first.getState().setHelpOpen(true);
  expect(first.getState()).toMatchObject({ room: "room-a", stake: "0.005", interval: 300, chartStyle: "line", helpOpen: true });
  expect(second.getState()).toMatchObject({ room: "", stake: "0.001", interval: 60, chartStyle: "candles", helpOpen: false });
});

it("isolates public transaction feedback between wallet scopes", () => {
  const first = createTransactionStore();
  first.setState({ busy: true });
  expect(createTransactionStore().getState()).toEqual({ busy: false });
});

it("keeps player disclosure explicit and replay safe", () => {
  const store = createUiStore();
  const dispatch = store.getState().dispatchPlayerRail;
  dispatch("open");
  dispatch("open");
  expect(store.getState().playerRail).toBe("open");
  dispatch("dismiss");
  dispatch("dismiss");
  expect(store.getState().playerRail).toBe("closed");
});

it("isolates rail state and clears it on actual room navigation", () => {
  const store = createUiStore();
  store.getState().dispatchPlayerRail("open");
  store.getState().setRoom("");
  expect(store.getState().playerRail).toBe("open");
  expect(createUiStore().getState().playerRail).toBe("closed");
  store.getState().setRoom("room-a");
  expect(store.getState().playerRail).toBe("closed");
});

it("starts with safe motion defaults and isolates system preference updates", () => {
  const store = createUiStore();
  expect(store.getState().reducedMotion).toBe(true);
  store.getState().setReducedMotion(false);
  expect(store.getState().reducedMotion).toBe(false);
  expect(createUiStore().getState().reducedMotion).toBe(true);
});

it("resets compact player disclosure on a responsive boundary", () => {
  const store = createUiStore();
  store.getState().dispatchPlayerRail("open");
  store.getState().setCompactPlayers(false);
  expect(store.getState()).toMatchObject({ compactPlayers: false, playerRail: "closed" });
  store.getState().setCompactPlayers(true);
  expect(store.getState()).toMatchObject({ compactPlayers: true, playerRail: "closed" });
  expect(createUiStore().getState().compactPlayers).toBe(true);
});

it("never describes an ER confirmation as a sale", () => {
  const accepted = operationNotification({ action: "Queue SELL", runtime: "er", status: "confirmed" });
  expect(accepted.title).toBe("Sell request accepted");
  expect(accepted.description).not.toMatch(/not been sold|waiting for|sale confirmed/i);
  expect(operationNotification({ action: "Claim USDC", runtime: "base", status: "pending" }).tone).toBe("warning");
  expect(operationNotification({ action: "Claim USDC", runtime: "base", status: "confirmed" }).title).toBe("USDC withdrawn");
});
