import type { Notification } from "./notifications.ts";
import { operationNotification } from "./notifications.ts";
import type { Operation } from "./operation.ts";

export type ActionErrorContext = Readonly<{ action: string; operation?: Operation }>;

const failedTitles: Record<string, string> = {
  "Create room": "Couldn't create the room", "Join room": "Couldn't join the room", "Start round": "Couldn't start the round",
  "Prepare MagicBlock": "Live setup unavailable", "Cancel room": "Couldn't cancel the room",
  "Claim USDC": "Couldn't withdraw USDC", "Claim WSOL": "Couldn't withdraw WSOL", "Recover round": "Couldn't recover the round",
  "Queue SELL": "Couldn't send your sell request", "Connect wallet": "Couldn't connect your wallet", "Disconnect wallet": "Couldn't disconnect your wallet",
};

function errorChain(value: unknown): Record<string, unknown>[] {
  const chain: Record<string, unknown>[] = [];
  const visited = new Set<unknown>();
  const queue = [value];
  while (queue.length && chain.length < 8) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);
    if (typeof current === "string") chain.push({ message: current });
    else if (current && typeof current === "object") {
      const entry = current as Record<string, unknown>;
      chain.push(entry);
      queue.push(entry.cause, entry.error);
    }
  }
  return chain;
}

export function isWalletCancellation(error: unknown) {
  return errorChain(error).some(entry => entry.code === 4001 || entry.code === "4001"
    || typeof entry.message === "string" && /\buser (?:rejected|declined|cancelled|canceled|denied)\b|\b(?:rejected|declined|cancelled|canceled|denied) by (?:the )?user\b|\b(?:wallet|signature|signing) request (?:cancelled|canceled)\b/i.test(entry.message));
}

export function actionErrorNotification(error: unknown, context: ActionErrorContext): Notification {
  if (context.operation?.status === "pending") return operationNotification(context.operation);
  if (context.operation?.status === "failed") return operationNotification(context.operation);
  if (isWalletCancellation(error)) return { tone: "info", title: "Request cancelled",
    description: context.action === "Connect wallet" ? "Your wallet wasn't connected. You can connect whenever you're ready."
      : context.action === "Revoke session" ? "Revocation wasn't sent. The local session is stopped, but its onchain permission may still be active."
        : "You cancelled in your wallet. This request wasn't submitted." };
  const detail = errorChain(error).map(entry => typeof entry.message === "string" ? entry.message : "").join(" ");
  if (/Price moved below your approved minimum/i.test(detail)) return { tone: "warning", title: "Price moved",
    description: "Your minimum was protected and no sale was sent. Review the updated quote before selling again." };
  if (/(?:Position|Cohort) changed; review a new sell quote/i.test(detail)) return { tone: "warning", title: "Position changed",
    description: "No sale was sent. Wait for the current round state, then review the updated quote." };
  if (/Selling is closed for this round/i.test(detail)) return { tone: "info", title: "Selling closed",
    description: "This request wasn't sent. Wait for Solana to finalize the round, then withdraw any remaining tokens." };
  if (/quote.*(?:expired|stale)|cohort.*closed/i.test(detail)) return { tone: "warning", title: "Quote expired",
    description: "No sale was sent. Quotes refresh automatically. If selling is still open, review the fresh quote and try again." };
  if (/insufficient.*(?:lamports|\bSOL\b|rent)|not enough.*(?:lamports|\bSOL\b)|no record of a prior credit/i.test(detail)) return { tone: "error", title: "Not enough SOL",
    description: "Your wallet needs SOL on this network for the stake, fees and account rent." };
  if (/insufficient|not enough/i.test(detail)) return { tone: "error", title: "Insufficient balance",
    description: "Check your token balance and leave enough SOL for fees and account rent." };
  if (/AccountNotFound|account does not exist/i.test(detail)) return { tone: "error", title: "Account not found",
    description: "Check your wallet's network and SOL balance. A required account is missing on this chain." };
  if (/signer changed|transaction message|wallet changed/i.test(detail)) return { tone: "error", title: "Wallet request changed",
    description: "The request was stopped for safety. Keep the same wallet connected and review a new request." };
  if (/network.*(?:mismatch|another|wrong)|genesis|another network/i.test(detail)) return { tone: "error", title: "Wrong network",
    description: "Switch your wallet to the network shown in FLINCH before continuing." };
  if (/storage|local transaction record/i.test(detail)) return { tone: "warning", title: "Transaction history unavailable",
    description: "Allow browser storage and check transaction status before trying again. Don't clear a pending transaction." };
  if (/unconfirmed|unknown.*outcome/i.test(detail)) return { tone: "warning", title: "Confirmation unavailable",
    description: "Your request may still complete. Use Check transaction before trying again." };
  if (/already in progress|another tab/i.test(detail)) return { tone: "info", title: "Another request is in progress",
    description: "Finish the open wallet request before starting another." };
  if (/preview was rejected|simulation failed/i.test(detail)) return { tone: "error", title: "Transaction preview failed",
    description: "The preview didn't pass, so this request wasn't sent. Check the room and your wallet before trying again." };
  if (/disconnected|not connected|connected wallet/i.test(detail)) return { tone: "info", title: "Connect your wallet",
    description: "Connect a wallet to continue with this action." };
  if (/disabled|enabled deployment/i.test(detail)) return { tone: "warning", title: "Transactions are paused",
    description: "Check your connection and whether gameplay is enabled on this network." };
  if (/Web Locks/i.test(detail)) return { tone: "error", title: "Browser not supported",
    description: "Use a secure, up-to-date browser so FLINCH can prevent duplicate requests." };
  if (context.action === "Get sell quote") return { tone: "warning", title: "Quote unavailable",
    description: "We couldn't get a current price for this position. Refresh the quote when live controls are ready." };
  if (context.action === "Revoke session") return { tone: "warning", title: "Revocation not confirmed",
    description: "The local session is stopped. Check transaction before retrying; its onchain permission may still be active." };
  if (context.action === "Check transaction") return { tone: "warning", title: "Couldn't check transaction",
    description: "Status is unavailable right now. Check again before repeating the original request." };
  return { tone: "error", title: failedTitles[context.action] ?? "Couldn't complete the request",
    description: "Check your connection and wallet, then try again." };
}
