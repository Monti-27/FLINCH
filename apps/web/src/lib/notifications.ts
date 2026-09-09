import type { Operation } from "./operation.ts";

export type Notification = Readonly<{ tone: "success" | "error" | "warning" | "info"; title: string; description: string }>;
type OperationState = Pick<Operation, "runtime" | "action" | "status">;

const completed: Record<string, readonly [string, string]> = {
  "Create room": ["Room created", "Take a seat, then share the invite."],
  "Join room": ["Seat secured", "Your stake is deposited. You're in."],
  "Start round": ["Round started", "The clock is running. Live controls unlock when MagicBlock is ready."],
  "Prepare MagicBlock": ["Live setup requested", "Waiting for MagicBlock before enabling sell requests."],
  "Cancel room": ["Room cancelled", "Deposited stakes are ready to withdraw."],
  "Revoke session": ["Session revocation recorded", "MagicBlock may take a moment to catch up. Already accepted sell requests remain valid."],
  "Claim USDC": ["USDC withdrawn", "Your USDC is back in your wallet."],
  "Claim WSOL": ["WSOL withdrawn", "Your WSOL is back in your wallet. It stays wrapped."],
  "Recover round": ["Round recovered", "Remaining balances are ready to withdraw. Earlier sales are unchanged."],
};

const preparing: Record<string, string> = {
  "Create room": "Creating your room…", "Join room": "Securing your seat…", "Start round": "Starting the round…",
  "Prepare MagicBlock": "Preparing live play…", "Cancel room": "Cancelling the room…", "Revoke session": "Revoking your session…",
  "Claim USDC": "Withdrawing USDC…", "Claim WSOL": "Withdrawing WSOL…", "Recover round": "Recovering the round…",
  "Queue SELL": "Sending your sell request…",
};

export function preparationMessage(action: string) { return preparing[action] ?? "Preparing your request…"; }

export function operationNotification(operation?: OperationState): Notification {
  if (!operation) return { tone: "warning", title: "No confirmation found", description: "Check transaction before trying again." };
  if (operation.status === "pending") return { tone: "warning", title: "Still waiting for confirmation",
    description: "This request may still complete. Use Check transaction before trying again." };
  if (operation.status === "not_sent") return { tone: "warning", title: "Sell request not sent",
    description: "Get a fresh quote before sending another sell request." };
  if (operation.status === "failed") return { tone: "error", title: "Transaction failed",
    description: "This transaction did not complete. Network fees may still apply." };
  if (operation.runtime === "er") return { tone: "info", title: "Sell request accepted",
    description: "MagicBlock received your request. Check your position for the sale result." };
  const [title, description] = completed[operation.action] ?? ["Request completed", "Check your position for the latest balances."];
  return { tone: "success", title, description };
}
