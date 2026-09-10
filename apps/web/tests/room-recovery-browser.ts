import assert from "node:assert/strict";
import { resolve } from "node:path";
import { expect } from "@playwright/test";
import type { Page, Route } from "@playwright/test";

export async function checkRoomReadRecovery(page: Page, base: string, er: string, directory: string) {
  const actions = await page.locator(".room-controls").elementHandle();
  assert(actions);
  for (const [name, endpoint, method] of [["base", base, "getMultipleAccounts"], ["er", er, "getIdentity"]]) {
    const message = `Injected ${name} read outage`;
    const displayed = name === "base" ? message : "RPC response failed validation";
    let intercepted = 0;
    const fail = async (route: Route) => {
      const body = route.request().postDataJSON();
      if (body?.method !== method) return route.continue();
      intercepted++;
      await route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ jsonrpc: "2.0", id: body.id, error: { code: -32000, message } }) });
    };
    await page.route(endpoint, fail);
    try {
      await expect(page.getByRole("status").filter({ hasText: displayed })).toBeVisible();
      assert(intercepted > 0);
      await expect(page.getByRole("button", { name: "Get sell quote", exact: true })).toBeDisabled();
      await expect(page.getByText("Current entitlement", { exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Room unavailable", exact: true })).toHaveCount(0);
      assert.equal(await actions.evaluate(element => element.isConnected), true);
      await page.screenshot({ path: resolve(directory, `room-${name}-outage.png`), fullPage: true });
    } finally { await page.unroute(endpoint, fail); }
    await expect(page.getByRole("status").filter({ hasText: displayed })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Get sell quote", exact: true })).toBeEnabled();
    assert.equal(await actions.evaluate(element => element.isConnected), true);
  }
  await actions.dispose();
  return { baseReadRecovery: true, erReadRecovery: true, retainedBalances: true, stableActionSurface: true };
}
