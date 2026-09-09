import { createStore } from "zustand/vanilla";
import type { SellQuote } from "@flinch/client";

type QuoteState = { quote?: SellQuote; loading: boolean; failed: boolean; paused: boolean };

export function createQuoteFeed(read: (signal: AbortSignal) => Promise<SellQuote>) {
  const store = createStore<QuoteState>(() => ({ loading: false, failed: false, paused: true }));
  let running = false;
  let failures = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;
  let request: Promise<SellQuote | undefined> | undefined;
  const refresh = (): Promise<SellQuote | undefined> => {
    if (!running) return Promise.resolve(undefined);
    if (request) return request;
    clearTimeout(timer);
    const current = new AbortController();
    controller = current;
    store.setState({ loading: true });
    const pending = Promise.resolve().then(() => read(current.signal)).then(quote => {
      if (controller !== current || current.signal.aborted) return;
      if (Date.now() < quote.receivedAtMs || Date.now() >= quote.expiresAtMs) throw new Error("Quote expired during refresh");
      failures = 0;
      store.setState({ quote, failed: false });
      return quote;
    }).catch((): undefined => {
      if (controller !== current || current.signal.aborted) return;
      failures++;
      store.setState({ failed: true });
    }).finally(() => {
      if (controller !== current) return;
      request = undefined;
      controller = undefined;
      store.setState({ loading: false });
      if (running) {
        const quote = store.getState().quote;
        const delay = failures ? Math.min(8000, 1000 * 2 ** Math.min(failures - 1, 3))
          : Math.max(250, Math.min(1000, (quote?.expiresAtMs ?? Date.now() + 1000) - Date.now() - 500));
        timer = setTimeout(() => void refresh(), delay);
      }
    });
    request = pending;
    return pending;
  };
  return { store, refresh,
    update: (quote: SellQuote) => store.setState({ quote, failed: false }),
    start: () => {
      if (running) return;
      running = true;
      failures = 0;
      store.setState({ paused: false });
      void refresh();
    },
    stop: () => {
      running = false;
      clearTimeout(timer);
      controller?.abort();
      controller = undefined;
      request = undefined;
      store.setState({ loading: false, paused: true });
    },
  };
}
