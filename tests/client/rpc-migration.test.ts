import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { FlinchClient } from "../../packages/client/src/client.ts";

test("explicit prior base endpoints reconcile through the verified replacement without resubmission", async t => {
  const methods: string[] = [];
  const server = createServer(async (request, response) => {
    let raw = "";
    for await (const chunk of request) raw += chunk;
    const rpc = JSON.parse(raw);
    methods.push(rpc.method);
    const result = rpc.method === "getGenesisHash" ? "local-genesis" : { context: { slot: 42 }, value: [
      { slot: 42, confirmations: 1, err: null, confirmationStatus: "confirmed" },
    ] };
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result }));
  });
  server.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  const address = server.address();
  assert(address && typeof address !== "string");
  const previous = ["http://127.0.0.1:1"];
  const client = new FlinchClient({ network: "localnet", baseUrl: `http://127.0.0.1:${address.port}`,
    expectedGenesis: "local-genesis", previousBaseUrls: previous }, { resolve: async () => assert.fail() });
  previous.push("http://127.0.0.1:2");
  assert.deepEqual(await client.status("base", previous[0], "1".repeat(64)), { kind: "confirmed", slot: 42 });
  await assert.rejects(client.status("base", previous[1], "1".repeat(64)), /differs/);
  await assert.rejects(client.status("er", "https://attacker.example", "1".repeat(64)), /policy/);
  assert.deepEqual(methods, ["getGenesisHash", "getSignatureStatuses"]);
});
