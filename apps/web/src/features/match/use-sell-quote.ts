"use client";

import { useEffect, useMemo } from "react";
import { useStore } from "zustand";
import type { PublicKey } from "@solana/web3.js";
import type { FlinchClient } from "@flinch/client";
import { createQuoteFeed } from "./quote-feed.ts";

export function useSellQuote(client: FlinchClient, ledger: PublicKey, seat: number, wallet: string | undefined, active: boolean, revision?: bigint) {
  const address = ledger.toBase58();
  const feed = useMemo(() => createQuoteFeed(signal => client.quote(ledger, seat, 100, signal)), [client, address, seat, wallet, revision]);
  const state = useStore(feed.store);
  useEffect(() => {
    const synchronize = () => {
      if (active && document.visibilityState !== "hidden" && navigator.onLine) feed.start();
      else feed.stop();
    };
    synchronize();
    document.addEventListener("visibilitychange", synchronize);
    window.addEventListener("online", synchronize);
    window.addEventListener("offline", synchronize);
    return () => {
      feed.stop();
      document.removeEventListener("visibilitychange", synchronize);
      window.removeEventListener("online", synchronize);
      window.removeEventListener("offline", synchronize);
    };
  }, [feed, active]);
  return { ...state, refresh: feed.refresh, update: feed.update, stop: feed.stop };
}
