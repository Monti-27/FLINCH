import type { Operation } from "../../lib/operation.ts";
import { Proof } from "./proof.tsx";

export function TransactionStatus({ busy, operation, network }: {
  busy: boolean; operation?: Operation; network: string;
}) {
  if (!operation) return null;
  return (
    <section className="transaction-panel" aria-label="Transaction activity" aria-busy={busy}>
      <h2>Activity</h2>
      {operation.status === "pending" && <p role="status">Confirmation pending. Use Check transaction before trying again.</p>}
      <details className="transaction-detail">
        <summary>Transaction details</summary>
        <Proof operation={operation} network={network} />
      </details>
    </section>
  );
}
