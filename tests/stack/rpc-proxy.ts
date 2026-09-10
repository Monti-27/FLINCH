import { createServer } from "node:http";
import anchor from "@coral-xyz/anchor";
import { VersionedTransaction } from "@solana/web3.js";
import { PROGRAM_ID } from "../../packages/client/src/index.ts";
import idl from "../../packages/client/generated/idl.json" with { type: "json" };
import { journal } from "./evidence.ts";

export type ProxiedSubmission = { signature: string; payer: string; action: string; receipt?: string };

export function describeSubmission(value: unknown): ProxiedSubmission | undefined {
  if (!value || typeof value !== "object") return;
  const rpc = value as { method?: unknown; params?: unknown[] };
  if (rpc.method !== "sendTransaction") return;
  if (typeof rpc.params?.[0] !== "string" || rpc.params[0].length > 2048) throw new Error("Invalid test submission");
  const transaction = VersionedTransaction.deserialize(Buffer.from(rpc.params[0], "base64"));
  if (transaction.message.addressTableLookups.length) throw new Error("Test proxy requires static account keys");
  const keys = transaction.message.staticAccountKeys;
  for (const instruction of transaction.message.compiledInstructions) {
    if (!keys[instruction.programIdIndex].equals(PROGRAM_ID)) continue;
    const definition = idl.instructions.find(item => Buffer.from(item.discriminator).equals(Buffer.from(instruction.data).subarray(0, 8)));
    if (!definition) throw new Error("Unknown FLINCH instruction");
    const receiptIndex = definition.accounts.findIndex(account => account.name === "receipt");
    return { signature: anchor.utils.bytes.bs58.encode(transaction.signatures[0]), payer: keys[0].toBase58(), action: definition.name,
      receipt: receiptIndex < 0 ? undefined : keys[instruction.accountKeyIndexes[receiptIndex]].toBase58() };
  }
}

export async function rpcProxy(upstream: string, directory: string, beforeSend: (submission: ProxiedSubmission) => Promise<void>) {
  if (new URL(upstream).hostname !== "127.0.0.1") throw new Error("Fault proxy is local-only");
  const server = createServer(async (request, response) => {
    let id: unknown = null;
    try {
      let body = "";
      for await (const chunk of request) {
        body += chunk.toString();
        if (body.length > 65_536) throw new Error("Test request too large");
      }
      const rpc = JSON.parse(body);
      id = rpc.id;
      const submission = describeSubmission(rpc);
      if (submission) {
        journal(directory, "proxied-submissions", { phase: "received", ...submission });
        await beforeSend(submission);
      }
      const upstreamResponse = await fetch(upstream, { method: "POST", headers: { "content-type": "application/json" },
        body, signal: AbortSignal.timeout(4000) });
      const reply = await upstreamResponse.text();
      if (submission) {
        const parsed = JSON.parse(reply);
        journal(directory, "proxied-submissions", { phase: "forwarded", ...submission, result: parsed.result, error: parsed.error });
      }
      response.writeHead(upstreamResponse.status, { "content-type": "application/json" }); response.end(reply);
    } catch {
      response.writeHead(502, { "content-type": "application/json" });
      response.end(JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32000, message: "Local fault proxy failed" } }));
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => { server.off("error", reject); resolve(); });
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing proxy address");
  return { url: `http://127.0.0.1:${address.port}`,
    stop: () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) };
}
