import { setTimeout } from "node:timers/promises";
import { ClientError } from "../../packages/client/src/errors.ts";

export function networkFailure(error: unknown) {
  if (!(error instanceof Error)) return null;
  if (error instanceof ClientError && error.code !== "rpc_error") return null;
  if (error.name === "TimeoutError") return { kind: "timeout" };
  if (error instanceof TypeError && error.message === "fetch failed") return { kind: "transport" };
  const status = /(?:^|HTTP status |: )(429|502|503|504)\b/.exec(error.message)?.[1];
  return status ? { kind: "http", status: Number(status) } : null;
}

export async function readRetry<T>(read: () => Promise<T>, signal?: AbortSignal) {
  for (let attempt = 0; attempt < 4; attempt++) {
    signal?.throwIfAborted();
    try { return await read(); }
    catch (error) {
      if (!networkFailure(error) || attempt === 3) throw error;
      await setTimeout(250 * 2 ** attempt, undefined, { signal });
    }
  }
  throw new Error("Read retry exhausted");
}
