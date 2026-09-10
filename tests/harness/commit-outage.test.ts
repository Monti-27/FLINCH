import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Keypair, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { DELEGATION_PROGRAM_ID } from "@magicblock-labs/ephemeral-rollups-sdk";
import { commitOutage, commitTarget } from "../stack/commit-outage.ts";

function fixture(writable = true, delegation = true) {
  const payer = Keypair.generate();
  const control = Keypair.generate().publicKey;
  const instruction = new TransactionInstruction({ programId: delegation ? DELEGATION_PROGRAM_ID : Keypair.generate().publicKey,
    keys: [{ pubkey: control, isWritable: writable, isSigner: false }] });
  const transaction = new VersionedTransaction(new TransactionMessage({ payerKey: payer.publicKey,
    recentBlockhash: Keypair.generate().publicKey.toBase58(), instructions: [instruction] }).compileToLegacyMessage());
  transaction.sign([payer]);
  const encoded = Buffer.from(transaction.serialize()).toString("base64");
  return { control, encoded, payer, rpc: { jsonrpc: "2.0", id: 1, method: "sendTransaction", params: [encoded, { encoding: "base64" }] } };
}

test("commit fault selects only a writable target used alongside the delegation program", () => {
  const matching = fixture();
  assert.equal(commitTarget(matching.rpc, matching.control)?.control, matching.control.toBase58());
  assert.equal(commitTarget(matching.rpc, Keypair.generate().publicKey), undefined);
  for (const candidate of [fixture(false), fixture(true, false)]) assert.equal(commitTarget(candidate.rpc, candidate.control), undefined);
  assert.equal(commitTarget({ method: "getAccountInfo" }, matching.control), undefined);
  assert.throws(() => commitTarget({ method: "sendTransaction", params: [matching.encoded, { encoding: "base58" }] }, matching.control));
  assert.throws(() => commitTarget({ method: "sendTransaction", params: ["x".repeat(2049)] }, matching.control));
});

test("local commit fault blocks targeted sends, forwards reads and resumes without logging signed bytes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "flinch-commit-fault-"));
  let forwarded = 0;
  const upstream = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk.toString();
    forwarded++;
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ jsonrpc: "2.0", id: JSON.parse(body).id, result: "test-upstream-response" }));
  });
  await new Promise<void>(resolve => upstream.listen(0, "127.0.0.1", resolve));
  const address = upstream.address();
  assert(address && typeof address !== "string");
  const proxy = await commitOutage(`http://127.0.0.1:${address.port}`, directory);
  try {
    const match = fixture();
    proxy.arm(match.control);
    const send = (body: unknown) => fetch(proxy.url, { method: "POST", body: JSON.stringify(body) });
    assert.equal((await send(match.rpc)).status, 503);
    assert.equal((await send(match.rpc)).status, 503);
    assert.equal(proxy.requests(), 2); assert.equal(forwarded, 0);
    assert.equal((await send({ jsonrpc: "2.0", id: 2, method: "getAccountInfo", params: [match.control.toBase58()] })).status, 200);
    assert.equal((await send(fixture().rpc)).status, 200);
    assert.equal(forwarded, 2);
    proxy.release();
    assert.equal((await send(match.rpc)).status, 200);
    assert.equal(forwarded, 3); assert.equal(proxy.requests(), 2);
    const log = await readFile(join(directory, "commit-transport.jsonl"), "utf8");
    assert(log.includes(match.control.toBase58()));
    assert(!log.includes(match.encoded));
    assert(!log.includes(Buffer.from(match.payer.secretKey).toString("base64")));
    assert.throws(() => proxy.arm(match.control));
    await assert.rejects(commitOutage("https://example.com", directory));
  } finally {
    await proxy.stop();
    await new Promise<void>((resolve, reject) => upstream.close(error => error ? reject(error) : resolve()));
    await rm(directory, { recursive: true, force: true });
  }
});
