import { afterEach, describe, expect, it, vi } from "vitest";
import { rpcGateway } from "../src/lib/rpc/gateway.ts";
import { boundedJson, rpcCall } from "../src/lib/rpc/policy.ts";
import { DEVNET_PROGRAM_ID } from "@flinch/client";
import { Connection, Transaction, SystemProgram, Keypair, VersionedTransaction } from "@solana/web3.js";

const config = { key: "test-key", origin: "https://flinch.example", pool: "pool", validator: "validator" };
const call = (method = "getGenesisHash", params: unknown[] = [], id: number | string = 7) => ({ jsonrpc: "2.0", id, method, params });
const request = (body: unknown = call(), headers: Record<string, string> = {}) => new Request("https://flinch.example/api/rpc", {
  method: "POST", headers: { "Content-Type": "application/json", Origin: config.origin, ...headers }, body: JSON.stringify(body),
});
const response = (result: unknown = "genesis") => Response.json({ jsonrpc: "2.0", id: 1, result });
afterEach(() => vi.useRealTimers());

describe("Devnet gateway", () => {
  it("keeps credentials on the fixed upstream and correlates responses", async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(response());
    const result = await rpcGateway(() => config, transport)(request());
    expect(await result.json()).toEqual({ jsonrpc: "2.0", id: 7, result: "genesis" });
    const [url, init] = transport.mock.calls[0];
    expect(String(url)).toBe("https://devnet.helius-rpc.com/?api-key=test-key");
    expect(init).toMatchObject({ method: "POST", redirect: "error", cache: "no-store" });
    expect(JSON.parse(String(init?.body))).toEqual(call("getGenesisHash", [], 1));
    expect(result.headers.get("cache-control")).toBe("no-store");
    expect(result.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("rejects unconfigured, cross-origin, non-JSON, oversized and unsupported calls without upstream traffic", async () => {
    const transport = vi.fn<typeof fetch>();
    expect((await rpcGateway(() => undefined, transport)(request())).status).toBe(503);
    const gateway = rpcGateway(() => config, transport);
    expect((await gateway(new Request("https://flinch.example/api/rpc"))).status).toBe(405);
    for (const [body, headers, status] of [
      [call(), { Origin: "https://other.example" }, 403],
      [call(), { "Sec-Fetch-Site": "cross-site" }, 403],
      [call(), { "Content-Type": "text/plain" }, 415],
      [call(), { "Content-Length": "20000" }, 413],
      [[call()], {}, 400], [call("requestAirdrop"), {}, 400],
      [call("sendTransaction", ["not-a-transaction"]), {}, 400],
      [call("getAccountInfo", ["x".repeat(20_000)]), {}, 400],
    ] as const) expect((await gateway(request(body, headers))).status).toBe(status);
    expect(transport).not.toHaveBeenCalled();
  });

  it("coalesces only concurrent identical reads and never caches completed account observations", async () => {
    vi.useFakeTimers();
    let finish: (value: Response) => void = () => undefined;
    const transport = vi.fn<typeof fetch>().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
      .mockImplementation(async () => response());
    const gateway = rpcGateway(() => config, transport);
    const first = gateway(request(call()));
    await vi.advanceTimersByTimeAsync(0);
    const second = gateway(request(call("getGenesisHash", [], "other")));
    await vi.advanceTimersByTimeAsync(0);
    expect(transport).toHaveBeenCalledTimes(1);
    finish(response());
    expect((await (await first).json()).id).toBe(7);
    expect((await (await second).json()).id).toBe("other");
    const third = gateway(request(call()));
    await vi.advanceTimersByTimeAsync(125);
    await third;
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it("bounds the queue and spaces requests within the free-tier rate", async () => {
    vi.useFakeTimers();
    const times: number[] = [];
    const transport = vi.fn<typeof fetch>().mockImplementation(async () => { times.push(Date.now()); return response(); });
    const gateway = rpcGateway(() => config, transport);
    const requests = Array.from({ length: 12 }, (_, index) => gateway(request(call("getSlot", [{ minContextSlot: index }], index))));
    await vi.advanceTimersByTimeAsync(1500);
    const results = await Promise.all(requests);
    expect(results.filter(result => result.status === 429)).toHaveLength(3);
    expect(times).toHaveLength(9);
    expect(times.slice(1).every((time, index) => time - times[index] >= 125)).toBe(true);
    expect(results[11].headers.get("retry-after")).toBe("1");
  });

  it("does not coalesce, mutate or retry signed submissions", async () => {
    vi.useFakeTimers();
    const transport = vi.fn<typeof fetch>().mockImplementation(async () => response("signature"));
    const gateway = rpcGateway(() => config, transport);
    const submission = call("sendTransaction", ["AQID", { encoding: "base64", skipPreflight: false }]);
    await gateway(request(submission));
    expect((await gateway(request(submission))).status).toBe(429);
    await vi.advanceTimersByTimeAsync(1100);
    await gateway(request(submission));
    expect(transport).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(transport.mock.calls[1][1]?.body)).params).toEqual(submission.params);
  });

  it("spaces distinct room scans below their separate free-tier limit", async () => {
    vi.useFakeTimers();
    const times: number[] = [];
    const gateway = rpcGateway(() => config, async () => { times.push(Date.now()); return response([]); });
    const requests = Array.from({ length: 6 }, (_, index) => gateway(request(call("getProgramAccounts", [
      DEVNET_PROGRAM_ID.toBase58(), { minContextSlot: index, filters: [
        { memcmp: { offset: 50, bytes: config.validator } }, { memcmp: { offset: 82, bytes: config.pool } },
      ] },
    ]))));
    await vi.advanceTimersByTimeAsync(1500);
    expect((await Promise.all(requests)).filter(result => result.status === 429)).toHaveLength(1);
    expect(times.slice(1).every((time, index) => time - times[index] >= 250)).toBe(true);
  });

  it("accepts the actual web3 request shapes used by the client", async () => {
    const observed: string[] = [];
    const base = new Connection("https://flinch.example/api/rpc", { commitment: "confirmed", fetch: async (_, init) => {
      const body = JSON.parse(String(init?.body));
      rpcCall(body, config);
      observed.push(body.method);
      return Response.json({ jsonrpc: "2.0", id: body.id, error: { code: -32000, message: "fixture" } });
    } });
    const key = DEVNET_PROGRAM_ID;
    const sig = "1".repeat(64);
    const payer = Keypair.generate();
    const transaction = new Transaction({ recentBlockhash: key.toBase58(), feePayer: payer.publicKey })
      .add(SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: key, lamports: 1 }));
    transaction.sign(payer);
    const reads = [base.getGenesisHash(), base.getLatestBlockhash(), base.getBlockHeight(), base.getSlot(),
      base.getAccountInfo(key), base.getBalance(key), base.getMultipleAccountsInfoAndContext([key]),
      base.getMinimumBalanceForRentExemption(100), base.getSignatureStatuses([sig], { searchTransactionHistory: true }),
      base.getTransaction(sig, { maxSupportedTransactionVersion: 0 }), base.getSignaturesForAddress(key, { limit: 16 }),
      base.simulateTransaction(new VersionedTransaction(transaction.compileMessage())),
      base.sendRawTransaction(transaction.serialize(), { skipPreflight: false, maxRetries: 0 })];
    const results = await Promise.allSettled(reads);
    expect(observed).toHaveLength(reads.length);
    expect(observed).toContain("simulateTransaction");
    expect(results[7]).toEqual({ status: "fulfilled", value: 0 });
    expect(results.filter((_, index) => index !== 7)
      .every(result => result.status === "rejected" && String(result.reason).includes("fixture"))).toBe(true);
  });

  it("sanitizes provider errors and propagates quota failures without retries", async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ jsonrpc: "2.0", id: 1,
      error: { code: -32429, message: "usage exceeded test-key" } }, { status: 429 }));
    const result = await rpcGateway(() => config, transport)(request());
    expect(result.status).toBe(429);
    expect(await result.text()).not.toContain(config.key);
    expect(transport).toHaveBeenCalledTimes(1);
    const broken = vi.fn<typeof fetch>().mockRejectedValue(new Error("secret test-key"));
    const failed = await rpcGateway(() => config, broken)(request());
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain(config.key);
    const mismatch = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ jsonrpc: "2.0", id: 9, result: {} }));
    expect((await rpcGateway(() => config, mismatch)(request())).status).toBe(502);
  });

  it("restricts room scans to the configured program, pool and validator", () => {
    const filters = [{ memcmp: { offset: 50, bytes: config.validator } }, { memcmp: { offset: 82, bytes: config.pool } }];
    expect(rpcCall(call("getProgramAccounts", [DEVNET_PROGRAM_ID.toBase58(), { filters }]), config).method).toBe("getProgramAccounts");
    for (const params of [[DEVNET_PROGRAM_ID.toBase58(), {}], ["other", { filters }],
      [DEVNET_PROGRAM_ID.toBase58(), { filters: filters.slice(0, 1) }]]) {
      expect(() => rpcCall(call("getProgramAccounts", params), config)).toThrow();
    }
    expect(() => rpcCall({ ...call(), target: "https://other.example" }, config)).toThrow();
    expect(() => rpcCall(call("getMultipleAccounts", [Array(65).fill(DEVNET_PROGRAM_ID.toBase58())]), config)).toThrow();
  });

  it("cancels oversized and aborted response streams", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(20)); }, cancel });
    await expect(boundedJson(stream, 10, new AbortController().signal)).rejects.toThrow("limit");
    expect(cancel).toHaveBeenCalledTimes(1);
    const abort = new AbortController();
    const stalled = boundedJson(new ReadableStream(), 100, abort.signal);
    abort.abort();
    await expect(stalled).rejects.toThrow();
  });
});
