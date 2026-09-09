"use client";

import { useEffect, useState } from "react";
import { formatUnits } from "@flinch/client";
import type { BaseRoom, FlinchClient, Receipt } from "@flinch/client";
import { Address } from "../../components/address.tsx";
import { Button } from "../../components/ui/button.tsx";
import { ReceiptSkeleton } from "./receipt-skeleton.tsx";

export function Receipts({ client, room }: { client: FlinchClient; room: BaseRoom }) {
  const [loaded, setLoaded] = useState<{ client: FlinchClient; address: string; receipts: readonly Receipt[] }>();
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const address = room.ledger.address.toBase58();
  const receipts = loaded?.client === client && loaded.address === address ? loaded.receipts : undefined;
  const revision = room.ledger.economics?.revision;
  useEffect(() => {
    let active = true;
    setError("");
    void client.receipts(room).then(receipts => { if (active) setLoaded({ client, address, receipts }); }).catch(value => { if (active) setError(value instanceof Error ? value.message : "Receipts unavailable"); });
    return () => { active = false; };
  }, [client, address, revision, retry]);
  if (receipts?.length === 0 && !error) return null;
  return <section className="settlement-history"><h2>Settlement history</h2>
    {error ? <><p role="alert" className="notice">{error}</p><Button variant="secondary" size="sm" onClick={() => setRetry(value => value + 1)}>Read receipts again</Button></>
      : !receipts ? <ReceiptSkeleton /> : receipts.length === 0 ? <p className="muted">No batch has settled or expired. A queued SELL is not a fill.</p>
      : <ol className="receipt-list">{receipts.map(receipt => <li key={receipt.address.toBase58()}>
        <strong>Batch {(receipt.revision + 1n).toString()} · {receipt.expired ? "Expired without a game penalty" : "Swap confirmed"}</strong>
        <p className="mono">{formatUnits(receipt.input, 9)} WSOL → {formatUnits(receipt.output, 6)} USDC</p>
        <Address value={receipt.address.toBase58()} label="settlement receipt" />
        {client.config.network === "devnet" && <a target="_blank" rel="noreferrer" href={`https://explorer.solana.com/address/${receipt.address.toBase58()}?cluster=devnet`}>View receipt ↗</a>}
      </li>)}</ol>}
  </section>;
}
