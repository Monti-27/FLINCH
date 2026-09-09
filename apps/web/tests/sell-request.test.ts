import { afterEach, expect, it, vi } from "vitest";
import { Connection, Keypair } from "@solana/web3.js";
import { DEVNET_GENESIS, quoteSell } from "@flinch/client";
import type { FlinchClient } from "@flinch/client";
import { controlInstructions } from "../../../packages/client/src/instructions/control.ts";
import { createProgram } from "../../../packages/client/src/program.ts";
import { control, snapshot, signer } from "../../../tests/keeper/fixtures.ts";
import { sellRequest } from "../src/features/match/sell-request.ts";
import { OperationRunner } from "../src/lib/operation.ts";

afterEach(() => vi.restoreAllMocks());

function fixture() {
  vi.spyOn(Date, "now").mockReturnValue(1000);
  const room = snapshot();
  const current = { ...control(room), sellers: 0 };
  const rpc = new Connection("https://devnet-as.magicblock.app/");
  rpc.getLatestBlockhash = async () => ({ blockhash: Keypair.generate().publicKey.toBase58(), lastValidBlockHeight: 50 });
  const quote = quoteSell({ pool: room.ledger.pool, slot: 50, chainTime: 101n, receivedAtMs: 1000,
    inputReserve: 100_000_000_000n, outputReserve: 20_000_000_000n, tradeFeeRate: 2500n,
    creatorFeeRate: 0n, fundFeeRate: 0n, protocolFeeRate: 0n, creatorFeeOnInput: true }, current, 0, 101n);
  let nextRpc = rpc;
  const read = vi.fn(async () => room);
  const resolve = vi.fn(async () => ({ connection: nextRpc, control: current, now: 101n }));
  const client = { config: { network: "devnet", expectedGenesis: DEVNET_GENESIS }, base: { getGenesisHash: async () => DEVNET_GENESIS },
    readRoom: read, resolve, quote: vi.fn(async () => quote), instructions: controlInstructions(createProgram(rpc)) } as unknown as FlinchClient;
  const sign = vi.fn(signer.sign);
  const values = new Map<string, string>();
  const runner = new OperationRunner({ getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } }, "test");
  const send = vi.fn(async () => {
    expect(runner.current()?.status).toBe("pending");
    expect(runner.current()?.endpoint).toBe(rpc.rpcEndpoint);
    return runner.current()!.signature;
  });
  rpc.sendRawTransaction = send;
  const request = sellRequest(client, quote, { ...signer, sign });
  const identity = { action: request.label, runtime: "er" as const, wallet: signer.publicKey.toBase58(), room: quote.ledger.toBase58() };
  return { client, request, runner, identity, read, resolve, sign, send, rpc,
    changePlacement: () => { nextRpc = new Connection("https://devnet-eu.magicblock.app/"); } };
}

it("prepares only under the operation guard, resolves twice and journals the verified ER before sending", async () => {
  const f = fixture();
  expect(f.read).not.toHaveBeenCalled();
  expect(f.sign).not.toHaveBeenCalled();
  await f.runner.run(f.client, f.identity, f.request.prepare!, f.request.submit);
  expect(f.read).toHaveBeenCalledTimes(2);
  expect(f.resolve).toHaveBeenCalledTimes(2);
  expect(f.sign).toHaveBeenCalledTimes(1);
  expect(f.client.quote).toHaveBeenCalledTimes(2);
  expect(f.send).toHaveBeenCalledTimes(1);
  expect(f.runner.current()?.endpoint).toBe(f.rpc.rpcEndpoint);
});

it("a placement change after signing records not-sent and never sends to either ER", async () => {
  const f = fixture();
  await expect(f.runner.run(f.client, f.identity, async () => {
    const prepared = await f.request.prepare!();
    f.changePlacement();
    return prepared;
  }, f.request.submit)).rejects.toThrow("placement changed");
  expect(f.resolve).toHaveBeenCalledTimes(2);
  expect(f.send).not.toHaveBeenCalled();
  expect(f.runner.current()?.status).toBe("not_sent");
});

it("rejecting wallet approval leaves no submission record and permits a deliberate new attempt", async () => {
  const f = fixture();
  f.sign.mockRejectedValueOnce(new Error("Wallet rejected"));
  await expect(f.runner.run(f.client, f.identity, f.request.prepare!, f.request.submit)).rejects.toThrow("Wallet rejected");
  expect(f.runner.current()).toBeUndefined();
  expect(f.send).not.toHaveBeenCalled();
  await f.runner.run(f.client, f.identity, f.request.prepare!, f.request.submit);
  expect(f.send).toHaveBeenCalledTimes(1);
});
