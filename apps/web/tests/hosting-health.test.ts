import { describe, it, expect, vi } from "vitest";
import { hostingHealth } from "../src/lib/hosting-health.ts";

describe("hosted readiness", () => {
  const env = { RAILWAY_PROJECT_ID: "project", FLINCH_KEEPER_URL: "http://keeper.railway.internal:8080",
    NEXT_PUBLIC_FLINCH_NETWORK: "devnet", NEXT_PUBLIC_FLINCH_ENABLE_TRANSACTIONS: "true" };
  const ready = { service: "flinch-keeper", healthy: true, network: "devnet", database: "connected", keeper: "running", transactionsEnabled: true };

  it("requires a real connected backend and database for hosted gameplay", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json(ready));
    expect(await hostingHealth(env, request)).toMatchObject({ healthy: true, backend: "connected", database: "connected" });
    expect(String(request.mock.calls[0][0])).toBe("http://keeper.railway.internal:8080/health");
    for (const change of [{ keeper: "disabled" }, { database: "unavailable" }, { healthy: false }, { network: "localnet" }, { transactionsEnabled: false }]) {
      expect((await hostingHealth(env, vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ...ready, ...change })))).healthy).toBe(false);
    }
  });

  it("fails closed on missing configuration, unsafe destinations, failed HTTP and transport errors", async () => {
    expect((await hostingHealth({ RAILWAY_PROJECT_ID: "project" })).healthy).toBe(false);
    expect((await hostingHealth({})).healthy).toBe(true);
    const request = vi.fn<typeof fetch>();
    for (const url of ["https://example.com", "http://localhost", "http://secret@keeper.railway.internal", "http://keeper.railway.internal/other"]) {
      expect((await hostingHealth({ ...env, FLINCH_KEEPER_URL: url }, request)).healthy).toBe(false);
    }
    expect(request).not.toHaveBeenCalled();
    expect((await hostingHealth(env, vi.fn<typeof fetch>().mockResolvedValue(Response.json(ready, { status: 503 })))).healthy).toBe(false);
    expect((await hostingHealth(env, vi.fn<typeof fetch>().mockRejectedValue(new Error("offline")))).healthy).toBe(false);
  });
});
