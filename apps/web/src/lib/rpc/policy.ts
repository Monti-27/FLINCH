import { DEVNET_PROGRAM_ID } from "@flinch/client";

export type RpcCall = { jsonrpc: "2.0"; id: string | number; method: string; params: unknown[] };
export type RpcScope = { pool: string; validator: string };
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const address = (value: unknown) => typeof value === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
const signature = (value: unknown) => typeof value === "string" && /^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(value);
const options = (value: unknown) => value === undefined || record(value);

export function rpcCall(value: unknown, scope: RpcScope): RpcCall {
  if (!record(value) || value.jsonrpc !== "2.0" || Object.keys(value).some(key => !["jsonrpc", "id", "method", "params"].includes(key))
    || !(typeof value.id === "string" && value.id.length <= 128 || Number.isSafeInteger(value.id))
    || typeof value.method !== "string" || !Array.isArray(value.params)) throw new Error("Invalid RPC request");
  const p = value.params;
  let valid = false;
  switch (value.method) {
    case "getGenesisHash": valid = p.length === 0; break;
    case "getLatestBlockhash": case "getBlockHeight": case "getSlot": valid = p.length <= 1 && options(p[0]); break;
    case "getAccountInfo": case "getBalance":
      valid = p.length >= 1 && p.length <= 2 && address(p[0]) && options(p[1]); break;
    case "getMultipleAccounts":
      valid = p.length >= 1 && p.length <= 2 && Array.isArray(p[0]) && p[0].length > 0 && p[0].length <= 64
        && p[0].every(address) && options(p[1]); break;
    case "getMinimumBalanceForRentExemption":
      valid = p.length >= 1 && p.length <= 2 && Number.isSafeInteger(p[0]) && Number(p[0]) >= 0 && Number(p[0]) <= 10_485_760 && options(p[1]); break;
    case "getSignatureStatuses":
      valid = p.length >= 1 && p.length <= 2 && Array.isArray(p[0]) && p[0].length > 0 && p[0].length <= 32
        && p[0].every(signature) && options(p[1]); break;
    case "getTransaction": valid = p.length >= 1 && p.length <= 2 && signature(p[0]) && options(p[1]); break;
    case "getSignaturesForAddress":
      valid = p.length >= 1 && p.length <= 2 && address(p[0]) && record(p[1]) && Number.isInteger(p[1].limit)
        && Number(p[1].limit) > 0 && Number(p[1].limit) <= 100; break;
    case "getProgramAccounts": {
      const filters = record(p[1]) ? p[1].filters : undefined;
      valid = p.length === 2 && p[0] === DEVNET_PROGRAM_ID.toBase58() && Array.isArray(filters) && filters.length <= 4
        && [[50, scope.validator], [82, scope.pool]].every(([offset, bytes]) => filters.some(filter =>
          record(filter) && record(filter.memcmp) && filter.memcmp.offset === offset && filter.memcmp.bytes === bytes));
      break;
    }
    case "simulateTransaction": case "sendTransaction":
      valid = p.length === 2 && typeof p[0] === "string" && p[0].length > 0 && p[0].length <= 1644
        && /^[A-Za-z0-9+/]+={0,2}$/.test(p[0]) && record(p[1]) && p[1].encoding === "base64";
      break;
  }
  if (!valid) throw new Error("RPC method or parameters are not allowed");
  return value as RpcCall;
}

export async function boundedJson(body: ReadableStream<Uint8Array> | null, limit: number, signal: AbortSignal): Promise<unknown> {
  if (!body) throw new Error("Missing body");
  const reader = body.getReader();
  const cancel = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener("abort", cancel, { once: true });
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      signal.throwIfAborted();
      const next = await reader.read();
      signal.throwIfAborted();
      if (next.done) break;
      length += next.value.length;
      if (length > limit) throw new Error("Body exceeds limit");
      chunks.push(next.value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return JSON.parse(new TextDecoder().decode(bytes));
  } finally { signal.removeEventListener("abort", cancel); cancel(); }
}
