import { parseHistory, parseTick, PRODUCT } from "./model.ts";
import type { MarketStore } from "./store.ts";

export function connectMarket(store: MarketStore) {
  let disposed = false;
  let socket: WebSocket | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0;
  let generation = 0;
  let abort = new AbortController();
  let lastMessage = Date.now();
  let lastTrade = Date.now();

  const disconnect = () => {
    generation++;
    abort.abort();
    clearTimeout(retry);
    if (socket) { socket.onclose = null; socket.close(); socket = undefined; }
  };
  const schedule = () => {
    if (disposed || document.hidden || !navigator.onLine) return;
    clearTimeout(retry);
    retry = setTimeout(() => void start(), Math.min(30_000, 1000 * 2 ** Math.min(attempt++, 5)));
  };
  const start = async () => {
    disconnect();
    if (disposed || document.hidden || !navigator.onLine) return;
    const current = generation;
    abort = new AbortController();
    store.getState().setStatus("connecting");
    try {
      const response = await fetch("/api/market", { cache: "no-store", signal: AbortSignal.any([abort.signal, AbortSignal.timeout(8000)]) });
      if (!response.ok) throw new Error("Market history is unavailable. Reconnecting automatically.");
      const history = parseHistory(await response.json());
      if (disposed || current !== generation) return;
      store.getState().replaceHistory(history);
      const feed = new WebSocket("wss://ws-feed.exchange.coinbase.com");
      socket = feed;
      lastMessage = Date.now();
      lastTrade = Date.now();
      socket.onopen = () => {
        if (current !== generation) return;
        feed.send(JSON.stringify({ type: "subscribe", product_ids: [PRODUCT], channels: ["ticker", "heartbeat"] }));
      };
      socket.onmessage = event => {
        if (disposed || current !== generation) return;
        try {
          const message: unknown = JSON.parse(event.data);
          lastMessage = Date.now();
          if (message && typeof message === "object" && "type" in message && message.type === "error") { feed.close(); return; }
          const tick = parseTick(message);
          if (tick) { attempt = 0; lastTrade = tick.time; store.getState().accept(tick); }
        } catch {
          store.getState().setStatus("stale", "An invalid or delayed market update was ignored.");
        }
      };
      socket.onerror = () => { if (current === generation) feed.close(); };
      socket.onclose = () => {
        if (disposed || current !== generation) return;
        store.getState().setStatus("offline", "Reference feed disconnected. Reconnecting automatically.");
        schedule();
      };
    } catch (error) {
      if (disposed || current !== generation) return;
      store.getState().setStatus("offline", error instanceof Error ? error.message : "Reference feed unavailable");
      schedule();
    }
  };
  const visibility = () => {
    if (document.hidden || !navigator.onLine) {
      disconnect();
      store.getState().setStatus("offline", document.hidden ? "Reference feed paused in the background" : "Offline. Last observed prices only.");
    } else void start();
  };
  const clock = setInterval(() => {
    store.getState().checkFreshness(Date.now());
    if (socket && (Date.now() - lastMessage > 20_000 || Date.now() - lastTrade > 30_000)) socket.close();
  }, 1000);
  document.addEventListener("visibilitychange", visibility);
  window.addEventListener("online", visibility);
  window.addEventListener("offline", visibility);
  void start();
  return () => {
    disposed = true;
    disconnect();
    clearInterval(clock);
    document.removeEventListener("visibilitychange", visibility);
    window.removeEventListener("online", visibility);
    window.removeEventListener("offline", visibility);
  };
}
