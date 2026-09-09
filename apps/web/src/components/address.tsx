"use client";

import { useState } from "react";

export function Address({ value, label = "address" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  return <span className="address"><button className="quiet mono" title={value} aria-label={`Copy ${label}: ${value}`} onClick={async () => {
    try { await navigator.clipboard.writeText(value); setCopied(true); setError(false); setTimeout(() => setCopied(false), 2000); }
    catch { setError(true); }
  }}>{copied ? "Copied" : `${value.slice(0, 4)}…${value.slice(-4)}`}</button>{error && <span role="status">Copy unavailable</span>}</span>;
}
