import { toast } from "sonner";
import type { Notification } from "./notifications.ts";
import { actionErrorNotification } from "./action-errors.ts";
import type { ActionErrorContext } from "./action-errors.ts";

class NotifiedActionError extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : "Action did not complete", { cause });
    this.name = "NotifiedActionError";
  }
}

export function notify(notification: Notification, id?: string | number) {
  return toast[notification.tone](notification.title, { id, description: notification.description,
    duration: notification.tone === "error" || notification.tone === "warning" ? 8000 : 5000 });
}

export function notifyActionError(error: unknown, context: ActionErrorContext, id?: string | number): Error {
  if (error instanceof NotifiedActionError) return error;
  notify(actionErrorNotification(error, context), id);
  return new NotifiedActionError(error);
}

export function notifyWalletError(error: Error) {
  if (!["WalletConnectionError", "WalletDisconnectionError", "WalletNotReadyError"].includes(error.name)) return;
  notifyActionError(error, { action: error.name === "WalletDisconnectionError" ? "Disconnect wallet" : "Connect wallet" });
}
