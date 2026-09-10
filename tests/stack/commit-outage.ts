import assert from "node:assert/strict";
import { createServer } from "node:http";
import anchor from "@coral-xyz/anchor";
import { VersionedTransaction } from "@solana/web3.js";
import type { PublicKey } from "@solana/web3.js";
import { DELEGATION_PROGRAM_ID } from "@magicblock-labs/ephemeral-rollups-sdk";
import { journal } from "./evidence.ts";

export function commitTarget(value: unknown, control: PublicKey) {
  if (!value || typeof value !== "object") return;
  const rpc = value as { method?: unknown; params?: unknown[] };
  if (rpc.method !== "sendTransaction") return;
  assert(typeof rpc.params?.[0] === "string" && rpc.params[0].length <= 2048);
  assert(rpc.params[1] && typeof rpc.params[1] === "object" && "encoding" in rpc.params[1] && rpc.params[1].encoding === "base64");
  const transaction = VersionedTransaction.deserialize(Buffer.from(rpc.params[0], "base64"));
  assert.equal(transaction.message.addressTableLookups.length, 0, "Commit fault requires static keys");
  const message = transaction.message;
  const index = message.staticAccountKeys.findIndex(key => key.equals(control));
  if (index < 0 || !message.isAccountWritable(index)) return;
  if (!message.compiledInstructions.some(instruction => message.staticAccountKeys[instruction.programIdIndex].equals(DELEGATION_PROGRAM_ID))) return;
  return { signature: anchor.utils.bytes.bs58.encode(transaction.signatures[0]), control: control.toBase58() };
}

export async function commitOutage(upstream: string, directory: string) {
  assert.equal(new URL(upstream).hostname, "127.0.0.1");
  let control: PublicKey | undefined;
  let blocked = false;
  let requests = 0;
  const server = createServer(async (request, response) => {
    let id: unknown = null;
    try {
      let body = "";
      for await (const chunk of request) {
        body += chunk.toString();
        assert(body.length <= 65_536);
      }
      const rpc = JSON.parse(body);
      id = rpc.id;
      const target = control ? commitTarget(rpc, control) : undefined;
      if (target) {
        journal(directory, "commit-transport", { ...target, blocked });
        if (blocked) {
          requests++;
          response.writeHead(503, { "content-type": "application/json" });
          response.end(JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32000, message: "Injected local commitment transport outage" } }));
          return;
        }
      }
      const remote = await fetch(upstream, { method: "POST", headers: { "content-type": "application/json" }, body,
        signal: AbortSignal.timeout(5000) });
      response.writeHead(remote.status, { "content-type": "application/json" });
      response.end(await remote.text());
    } catch {
      response.writeHead(502, { "content-type": "application/json" });
      response.end(JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32000, message: "Local commit transport failed" } }));
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => { server.off("error", reject); resolve(); });
  });
  const address = server.address();
  assert(address && typeof address !== "string");
  return { url: `http://127.0.0.1:${address.port}`, requests: () => requests,
    arm: (target: PublicKey) => { assert(!control); control = target; blocked = true; },
    release: () => { blocked = false; },
    stop: () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) };
}
