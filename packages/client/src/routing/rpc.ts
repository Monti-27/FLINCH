import { ClientError } from "../errors.ts";

export type RpcRequest = (url: string, method: string, params: unknown[], signal?: AbortSignal) => Promise<unknown>;
export const rpcRequest: RpcRequest = async (url, method, params, signal) => {
  signal?.throwIfAborted();
  const response = await fetch(url, { method: "POST", redirect: "error",
    headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(5000)]) : AbortSignal.timeout(5000) });
  if (!response.ok) throw new ClientError("rpc_error", `RPC HTTP status ${response.status}`);
  const text = await response.text();
  if (text.length > 262144) throw new ClientError("rpc_error", "RPC response exceeds size limit");
  const body: unknown = JSON.parse(text);
  if (!isRecord(body) || body.jsonrpc !== "2.0" || body.id !== 1 || body.error || !("result" in body)) throw new ClientError("rpc_error", "RPC response failed validation");
  return body.result;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
