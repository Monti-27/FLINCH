import { beforeEach, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { actionErrorNotification, isWalletCancellation } from "../src/lib/action-errors.ts";
import { operationNotification, preparationMessage } from "../src/lib/notifications.ts";
import { notifyActionError, notifyWalletError } from "../src/lib/notify-action.ts";
import type { Operation } from "../src/lib/operation.ts";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), info: vi.fn(), warning: vi.fn(), success: vi.fn() } }));
beforeEach(() => vi.clearAllMocks());

it.each([
  ["Create room", "Room created"], ["Join room", "Seat secured"], ["Start round", "Round started"],
  ["Prepare MagicBlock", "Live setup requested"], ["Cancel room", "Room cancelled"], ["Revoke session", "Session revocation recorded"],
  ["Claim USDC", "USDC withdrawn"], ["Claim WSOL", "WSOL withdrawn"], ["Recover round", "Round recovered"],
])("uses specific copy for %s", (action, title) => {
  const result = operationNotification({ action, runtime: "base", status: "confirmed" });
  expect(result).toMatchObject({ title, tone: "success" });
  expect(result.description).not.toContain("confirmed on Solana");
  expect(preparationMessage(action)).not.toBe("Preparing your request…");
});

it.each([
  new Error("User rejected the request."), { code: 4001 }, { code: "4001" },
  new Error("Wallet request failed", { cause: { code: 4001 } }),
  { name: "WalletSignTransactionError", error: new Error("User declined the request") },
  "Request rejected by the user", "User canceled request",
])("recognizes wallet cancellation without treating it as failure: %s", error => {
  expect(isWalletCancellation(error)).toBe(true);
  expect(actionErrorNotification(error, { action: "Create room" })).toMatchObject({ tone: "info", title: "Request cancelled" });
});

it.each([new Error("Transaction preview was rejected"), new Error("Signer changed the transaction message"),
  new Error("Session authorization rejected"), { code: -32603 }, { code: 4100 }, new Error("Simulation failed for user instruction")])(
  "does not misclassify a real error as cancellation: %s", error => {
    expect(isWalletCancellation(error)).toBe(false);
    expect(actionErrorNotification(error, { action: "Create room" }).tone).toBe("error");
  });

it("bounds cyclic wallet error traversal", () => {
  const error: { cause?: unknown; message: string } = { message: "Network unavailable" };
  error.cause = error;
  expect(isWalletCancellation(error)).toBe(false);
});

it("unknown signed submissions take precedence over wallet rejection text", () => {
  const result = actionErrorNotification(new Error("User rejected the request."), {
    action: "Claim USDC", operation: { status: "pending" } as Operation,
  });
  expect(result).toMatchObject({ tone: "warning", title: "Still waiting for confirmation" });
  expect(result.description).toContain("Check transaction");
  expect(result.description).not.toContain("wasn't submitted");
});

it("keeps cancelled revocation distinct from a revoked onchain session", () => {
  const result = actionErrorNotification({ code: 4001 }, { action: "Revoke session" });
  expect(result.description).toContain("onchain permission may still be active");
});

it.each([
  ["Quote expired", "Quote expired", "warning"], ["AccountNotFound", "Account not found", "error"],
  ["Price moved below your approved minimum", "Price moved", "warning"],
  ["Position changed; review a new sell quote", "Position changed", "warning"],
  ["Insufficient funds for rent", "Not enough SOL", "error"], ["Wallet changed during signing", "Wallet request changed", "error"],
  ["Wrong genesis", "Wrong network", "error"], ["local storage unavailable", "Transaction history unavailable", "warning"],
  ["Transaction preview was rejected", "Transaction preview failed", "error"],
])("translates %s into actionable copy", (message, title, tone) => {
  expect(actionErrorNotification(new Error(message), { action: "Create room" })).toMatchObject({ title, tone });
});

it("does not expose arbitrary provider URLs, logs or raw errors in toast copy", () => {
  const result = actionErrorNotification(new Error("RPC failed: https://provider.invalid/?api-key=example-test-only"), { action: "Create room" });
  expect(JSON.stringify(result)).not.toContain("provider.invalid");
  expect(JSON.stringify(result)).not.toContain("api-key");
  expect(result.title).toBe("Couldn't create the room");
});

it("does not blame SOL for an unspecified token shortage", () => {
  expect(actionErrorNotification(new Error("Insufficient funds"), { action: "Claim USDC" }).title).toBe("Insufficient balance");
});

it("asks for another status check, not another transaction, when reconciliation is offline", () => {
  const result = actionErrorNotification(new Error("Failed to fetch"), { action: "Check transaction" });
  expect(result).toMatchObject({ tone: "warning", title: "Couldn't check transaction" });
  expect(result.description).toContain("before repeating the original request");
});

it("updates one loading toast and does not duplicate the component's catch notification", () => {
  const original = new Error("User rejected the request.");
  const handled = notifyActionError(original, { action: "Create room" }, 41);
  expect(notifyActionError(handled, { action: "Create room" })).toBe(handled);
  expect(handled.cause).toBe(original);
  expect(toast.info).toHaveBeenCalledExactlyOnceWith("Request cancelled", expect.objectContaining({ id: 41, duration: 5000 }));
  expect(toast.error).not.toHaveBeenCalled();
  notifyActionError(original, { action: "Create room" }, 42);
  expect(toast.info).toHaveBeenCalledTimes(2);
});

it("leaves signature errors to the action flow while reporting connection cancellation", () => {
  notifyWalletError(Object.assign(new Error("User rejected the request."), { name: "WalletSignTransactionError" }));
  expect(toast.info).not.toHaveBeenCalled();
  notifyWalletError(Object.assign(new Error("User rejected the request."), { name: "WalletConnectionError" }));
  expect(toast.info).toHaveBeenCalledExactlyOnceWith("Request cancelled", expect.objectContaining({ description: expect.stringContaining("wasn't connected") }));
});
