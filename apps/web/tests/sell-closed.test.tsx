import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { actionErrorNotification } from "../src/lib/action-errors.ts";
import { Standoff } from "../src/features/match/standoff.tsx";
import { UiProvider } from "../src/providers/ui-provider.tsx";
import { snapshot } from "../../../tests/keeper/fixtures.ts";

it("labels a closed sell window as finalizing until the base ledger is terminal", () => {
  const room = { ...snapshot(), now: 190n };
  const html = renderToStaticMarkup(<UiProvider><Standoff room={room} remaining={0n} /></UiProvider>);
  expect(html).toContain("Selling closed");
  expect(html).toContain("Finalizing positions");
  expect(html).not.toContain("Round complete");
});

it("never suggests another SELL after the round has closed", () => {
  const message = actionErrorNotification(new Error("Selling is closed for this round"), { action: "Queue SELL" });
  expect(message.title).toBe("Selling closed");
  expect(message.description).toContain("wasn't sent");
  expect(message.description).not.toContain("try");
});
