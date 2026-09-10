import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { Header } from "../src/components/shell/header.tsx";
import { UiProvider } from "../src/providers/ui-provider.tsx";
import { DEVNET_GENESIS } from "@flinch/client";

vi.mock("../src/components/shell/wallet-control.tsx", () => ({ WalletControl: () => null }));

it.each([false, true])("links the logo to the landing page instead of the lobby when inRoom is %s", inRoom => {
  const home = vi.fn();
  const html = renderToStaticMarkup(<UiProvider><Header config={{ network: "devnet", expectedGenesis: DEVNET_GENESIS,
    baseUrl: "https://rpc.magicblock.app/devnet", transactions: false }} home={home} inRoom={inRoom} /></UiProvider>);
  expect(html).toMatch(/<a\b[^>]*href="\/"[^>]*aria-label="FLINCH home"/);
  expect(html).not.toMatch(/<button\b[^>]*aria-label="FLINCH home"/);
  expect(html).toContain("Arena");
  expect(home).not.toHaveBeenCalled();
});
