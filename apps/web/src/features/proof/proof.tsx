import type { Operation } from "../../lib/operation.ts";
import { Address } from "../../components/address.tsx";

export function Proof({ operation, network }: { operation?: Operation; network: string }) {
  if (!operation) return <p className="muted">No transaction selected. Check saved status to restore a pending operation after reload.</p>;
  return <div className="proof"><strong>{operation.action} · {operation.status}</strong>
    <p>{operation.runtime === "er" ? "MagicBlock acceptance is not a sale. USDC is credited only after a confirmed Solana swap." : "Solana confirmation is shown separately from the current claimable balances."}</p>
    <Address value={operation.signature} label="transaction signature" />
    {network === "devnet" && operation.runtime === "base" && <a target="_blank" rel="noreferrer" href={`https://explorer.solana.com/tx/${operation.signature}?cluster=devnet`}>View on Solana Explorer ↗</a>}
  </div>;
}
