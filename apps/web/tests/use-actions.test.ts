import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PublicKey } from "@solana/web3.js";
import { DEVNET_GENESIS, SellNotSubmittedError } from "@flinch/client";
import type { FlinchClient, PreparedTransaction, TransactionSigner } from "@flinch/client";
import { toast } from "sonner";
import { useActions } from "../src/lib/use-actions.ts";
import { notifyActionError } from "../src/lib/notify-action.ts";
import type { Operation } from "../src/lib/operation.ts";

vi.mock("react", async load => ({ ...await load<typeof import("react")>(),
  useMemo: (factory: () => unknown) => factory(), useRef: (current: unknown) => ({ current }),
}));
vi.mock("zustand", () => ({ useStore: (store: { getState: () => unknown }, select: (state: unknown) => unknown) => select(store.getState()) }));
vi.mock("sonner", () => ({ toast: { loading: vi.fn(() => 31), error: vi.fn(), info: vi.fn(), warning: vi.fn(), success: vi.fn() } }));

const wallet = PublicKey.default;
const signature = "1".repeat(64);

function fixture() {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("navigator", { locks: { request: async (_name: string, _options: unknown, run: (lock: object) => unknown) => run({}) } });
  const status = vi.fn(async () => ({ kind: "confirmed" }));
  const client = { config: { network: "devnet", expectedGenesis: DEVNET_GENESIS },
    base: { getGenesisHash: async () => DEVNET_GENESIS, rpcEndpoint: "http://127.0.0.1:8899" }, status } as unknown as FlinchClient;
  const prepare = vi.fn(async () => ({ rpc: client.base, prepared: { submission: { signature } } as PreparedTransaction }));
  const submit = vi.fn(async () => signature);
  const request = { label: "Create room", room: wallet, signer: { publicKey: wallet } as TransactionSigner, prepare, submit };
  const actions = useActions(client, wallet.toBase58(), true);
  return { actions, client, request, prepare, submit, storage, values, status };
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it("replaces loading with a single cancellation toast without journaling or submitting", async () => {
  const f = fixture();
  f.prepare.mockRejectedValueOnce(Object.assign(new Error("User rejected the request."), { code: 4001 }));
  await f.actions.run(f.request).catch(error => notifyActionError(error, { action: "Create room" }));
  expect(f.submit).not.toHaveBeenCalled();
  expect(f.values.size).toBe(0);
  expect(toast.info).toHaveBeenCalledExactlyOnceWith("Request cancelled", expect.objectContaining({ id: 31 }));
  expect(toast.error).not.toHaveBeenCalled();
  expect(f.actions).not.toHaveProperty("message");
  await f.actions.run(f.request);
  expect(f.submit).toHaveBeenCalledTimes(1);
  expect(toast.success).toHaveBeenCalledWith("Room created", expect.objectContaining({ id: 31 }));
});

it("does not replace a prior confirmed action with a cancellation or show it as success again", async () => {
  const f = fixture();
  await f.actions.run(f.request);
  vi.clearAllMocks();
  f.prepare.mockRejectedValueOnce({ code: 4001 });
  await expect(f.actions.run(f.request)).rejects.toThrow();
  expect(toast.info).toHaveBeenCalledExactlyOnceWith("Request cancelled", expect.any(Object));
  expect(toast.success).not.toHaveBeenCalled();
  expect([...f.values.values()].map(value => JSON.parse(value).status)).toEqual(["confirmed"]);
});

it("keeps an unknown submission pending even if its provider error says user rejected", async () => {
  const f = fixture();
  f.submit.mockRejectedValueOnce(new Error("User rejected the request."));
  await expect(f.actions.run(f.request)).rejects.toThrow("User rejected");
  expect(toast.warning).toHaveBeenCalledExactlyOnceWith("Still waiting for confirmation", expect.objectContaining({ id: 31 }));
  expect(toast.info).not.toHaveBeenCalled();
  expect([...f.values.values()].map(value => JSON.parse(value).status)).toEqual(["pending"]);
});

it("shows a failed transaction only once and retains its proof", async () => {
  const f = fixture();
  f.status.mockResolvedValue({ kind: "failed" });
  await f.actions.run(f.request).catch(error => notifyActionError(error, { action: "Create room" }));
  expect(toast.error).toHaveBeenCalledExactlyOnceWith("Transaction failed", expect.objectContaining({ id: 31 }));
  expect([...f.values.values()].map(value => JSON.parse(value).status)).toEqual(["failed"]);
  expect(toast.success).not.toHaveBeenCalled();
});

it("keeps ER acceptance informational and specific", async () => {
  const f = fixture();
  await f.actions.run({ ...f.request, label: "Queue SELL", runtime: "er" });
  expect(toast.info).toHaveBeenCalledExactlyOnceWith("Sell request accepted", expect.objectContaining({ id: 31 }));
  expect(toast.success).not.toHaveBeenCalled();
});

it("reports known-unsent stale quotes without declaring a failed sale", async () => {
  const f = fixture();
  f.submit.mockRejectedValueOnce(new SellNotSubmittedError("Quote expired"));
  await expect(f.actions.run({ ...f.request, label: "Queue SELL", runtime: "er" })).rejects.toThrow("Quote expired");
  expect(toast.warning).toHaveBeenCalledExactlyOnceWith("Quote expired", expect.objectContaining({ id: 31 }));
  expect([...f.values.values()].map(value => JSON.parse(value).status)).toEqual(["not_sent"]);
});

it("warns after the confirmation window and never automatically repeats the request", async () => {
  vi.useFakeTimers();
  const f = fixture();
  f.status.mockResolvedValue({ kind: "pending" });
  const pending = f.actions.run(f.request);
  await vi.runAllTimersAsync();
  expect((await pending as Operation).status).toBe("pending");
  expect(f.prepare).toHaveBeenCalledTimes(1);
  expect(f.submit).toHaveBeenCalledTimes(1);
  expect(toast.warning).toHaveBeenCalledExactlyOnceWith("Still waiting for confirmation", expect.objectContaining({ id: 31 }));
});

it("toasts storage failures without leaving a stuck loading notification", async () => {
  const f = fixture();
  f.storage.getItem = () => { throw new Error("Browser storage unavailable"); };
  await expect(f.actions.run(f.request)).rejects.toThrow("storage unavailable");
  expect(toast.warning).toHaveBeenCalledExactlyOnceWith("Transaction history unavailable", expect.objectContaining({ id: 31 }));
  expect(f.prepare).not.toHaveBeenCalled();
  expect(f.submit).not.toHaveBeenCalled();
});

it("handles empty and failed manual status checks through Sonner", async () => {
  const f = fixture();
  await f.actions.check(wallet.toBase58());
  expect(toast.info).toHaveBeenCalledExactlyOnceWith("No saved transaction", expect.any(Object));
  f.storage.getItem = () => { throw new Error("Browser storage unavailable"); };
  await f.actions.check(wallet.toBase58());
  expect(toast.warning).toHaveBeenCalledExactlyOnceWith("Transaction history unavailable", expect.any(Object));
});
