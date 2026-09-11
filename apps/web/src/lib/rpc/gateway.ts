import { boundedJson, rpcCall } from "./policy.ts";
import type { RpcCall, RpcScope } from "./policy.ts";

type Config = RpcScope & { key: string; origin: string };
type Result = { status: number; body: Record<string, unknown> };
const headers = { "Cache-Control": "no-store", "Content-Type": "application/json" };
const failure = (status: number, message: string, id: unknown = null): Result =>
  ({ status, body: { jsonrpc: "2.0", id, error: { code: status === 429 ? -32005 : -32603, message } } });

export function rpcGateway(config: () => Config | undefined, transport: typeof fetch = fetch, clock = Date.now) {
  const pending = new Map<string, Promise<Result>>();
  let nextRequest = 0;
  let nextSend = 0;
  let nextScan = 0;

  async function forward(call: RpcCall, settings: Config): Promise<Result> {
    const now = clock();
    const start = Math.max(now, nextRequest, call.method === "sendTransaction" ? nextSend : 0,
      call.method === "getProgramAccounts" ? nextScan : 0);
    if (start - now > 1000) return failure(429, "Devnet request capacity reached. Retry shortly.");
    nextRequest = start + 125;
    if (call.method === "sendTransaction") nextSend = start + 1100;
    if (call.method === "getProgramAccounts") nextScan = start + 250;
    const signal = AbortSignal.timeout(4000);
    try {
      if (start > now) await new Promise(resolve => setTimeout(resolve, start - now));
      const url = new URL("https://devnet.helius-rpc.com/");
      url.searchParams.set("api-key", settings.key);
      const response = await transport(url, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...call, id: 1 }), signal, redirect: "error", cache: "no-store" });
      const data = await boundedJson(response.body, 2_097_152, signal);
      if (!data || typeof data !== "object" || Array.isArray(data)) return failure(502, "Invalid Devnet response");
      const body = data as Record<string, unknown>;
      if (body.jsonrpc !== "2.0" || body.id !== 1 || !("result" in body || "error" in body)) return failure(502, "Invalid Devnet response");
      const clean = JSON.parse(JSON.stringify(body).replaceAll(settings.key, "[redacted]"));
      return { status: response.ok ? 200 : response.status === 429 ? 429 : 503, body: clean };
    } catch { return failure(503, "Devnet RPC is temporarily unavailable"); }
  }

  return async (request: Request): Promise<Response> => {
    const reply = ({ body, status }: Result) => Response.json(body, { status, headers: {
      ...headers, ...(status === 429 ? { "Retry-After": "1" } : {}) } });
    if (request.method !== "POST") return reply(failure(405, "POST required"));
    const settings = config();
    if (!settings?.key || !settings.origin || !settings.pool || !settings.validator) return reply(failure(503, "Devnet RPC is not configured"));
    const origin = request.headers.get("origin");
    if (origin && origin !== settings.origin || request.headers.get("sec-fetch-site") === "cross-site") return reply(failure(403, "Origin is not allowed"));
    if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return reply(failure(415, "JSON required"));
    if (Number(request.headers.get("content-length") ?? 0) > 16_384) return reply(failure(413, "Request exceeds limit"));
    let call: RpcCall;
    try { call = rpcCall(await boundedJson(request.body, 16_384, AbortSignal.any([request.signal, AbortSignal.timeout(1000)])), settings); }
    catch { return reply(failure(400, "RPC method or parameters are not allowed")); }
    const share = call.method !== "sendTransaction" && call.method !== "simulateTransaction";
    const identity = JSON.stringify([call.method, call.params]);
    let result = share ? pending.get(identity) : undefined;
    if (!result) {
      result = forward(call, settings);
      if (share) {
        pending.set(identity, result);
        void result.finally(() => pending.delete(identity));
      }
    }
    const response = await result;
    return reply({ ...response, body: { ...response.body, id: call.id } });
  };
}
