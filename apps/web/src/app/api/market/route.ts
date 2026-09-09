import { parseHistory } from "../../../features/market/model.ts";

export const dynamic = "force-dynamic";
let cached: { value: unknown; expires: number } | undefined;
let pending: Promise<unknown> | undefined;

async function history() {
  if (cached && cached.expires > Date.now()) return cached.value;
  if (pending) return pending;
  pending = (async () => {
    const response = await fetch("https://api.exchange.coinbase.com/products/SOL-USD/candles?granularity=60", {
      signal: AbortSignal.timeout(5000), cache: "no-store", headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error("Market source unavailable");
    const value: unknown = await response.json();
    parseHistory(value);
    cached = { value, expires: Date.now() + 10_000 };
    return value;
  })();
  try { return await pending; } finally { pending = undefined; }
}

export async function GET() {
  try { return Response.json(await history(), { headers: { "Cache-Control": "no-store" } }); }
  catch { return Response.json({ error: "Reference market data unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
