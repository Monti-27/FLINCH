"use client";

import { useEffect, useMemo } from "react";
import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";
import type { FlinchClient } from "@flinch/client";
import { readRoomView } from "./room-observation.ts";
import type { RoomView } from "./room-observation.ts";

export function useRoom(client: FlinchClient, address: string) {
  const store = useMemo(() => createStore<{ view: RoomView }>()(() => ({ view: { observedAt: 0, loading: !!address } })), [client, address]);
  const view = useStore(store, state => state.view);
  useEffect(() => {
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const setView = (view: RoomView) => store.setState({ view });
    setView({ observedAt: 0, loading: !!address });
    if (!address) return;
    const read = async () => {
      try {
        const next = await readRoomView(client, address, store.getState().view, abort.signal);
        if (!abort.signal.aborted) setView(next);
      } catch {
        if (!abort.signal.aborted) setView({ ...store.getState().view, control: undefined, error: "Cannot refresh room.", loading: false });
      } finally { if (!abort.signal.aborted) timer = setTimeout(read, 1000); }
    };
    void read();
    return () => { abort.abort(); clearTimeout(timer); };
  }, [client, address, store]);
  return view;
}
