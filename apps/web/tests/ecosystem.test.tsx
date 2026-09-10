import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { EcosystemIcon } from "../src/components/brand/ecosystem-icon.tsx";
import { TokenAmountInput } from "../src/components/ui/token-amount-input.tsx";
import { Footer } from "../src/components/shell/footer.tsx";
import { NavigationContent, protocolLinks } from "../src/components/shell/navigation-content.tsx";
import { UiProvider } from "../src/providers/ui-provider.tsx";

const hashes = {
  "solana.svg": "3d3401109aa061dec40a8659f1847817a8e647f98de1e65e76e86a95bbe1f08a",
  "magicblock.svg": "8fbf4b21e5dc7dc630650ce32d130027e9d26e5047b49e798761f8cd9af0219b",
  "raydium.png": "f87f5707724686c3b12e3ffa7b69a0abcb434c63a691e2f3d9567744aa56b488",
  "usdc.svg": "fe4f9d5f34ef4ebeb5d80e1f5ff63dcaf5a0d5495f4adf206e4c3011d1f5c57d",
};

it("preserves the reviewed official assets without scripts or external SVG dependencies", () => {
  for (const [file, hash] of Object.entries(hashes)) {
    const source = readFileSync(new URL(`../public/brand/ecosystem/${file}`, import.meta.url));
    expect(createHash("sha256").update(source).digest("hex")).toBe(hash);
    if (file.endsWith(".svg")) {
      expect(source.toString()).toContain('xmlns="http://www.w3.org/2000/svg"');
      expect(source.toString()).not.toMatch(/<script|<foreignObject|<image|<style|\bon\w+=|(?:href|xlink:href)=/i);
    } else expect(source.subarray(1, 4).toString()).toBe("PNG");
  }
});

it("serves decorative marks locally in fixed boxes without duplicate accessible names", () => {
  const html = renderToStaticMarkup(<EcosystemIcon name="solana" size={24} />);
  expect(html).toContain('src="/brand/ecosystem/solana.svg"');
  expect(html).toContain('alt=""');
  expect(html).toContain('aria-hidden="true"');
  expect(html).toContain('width:24px;height:24px');
  expect(html).not.toMatch(/https:|srcSet=|\/_next\/image/);
});

it("can name a standalone meaningful mark", () => {
  const html = renderToStaticMarkup(<EcosystemIcon name="magicblock" label="MagicBlock" />);
  expect(html).toContain('alt="MagicBlock"');
  expect(html).not.toContain("aria-hidden");
});

it("uses the same official icons in the footer and protocol menu", () => {
  const footer = renderToStaticMarkup(<UiProvider><Footer config={{ network: "devnet", transactions: false }} /></UiProvider>);
  const menu = renderToStaticMarkup(<NavigationContent panel="protocol" />);
  for (const link of protocolLinks) {
    for (const html of [footer, menu]) {
      expect(html).toContain(`/brand/ecosystem/${link.icon}.`);
      expect(html).toContain(`href="${link.href}"`);
    }
  }
  expect(footer).toContain("MagicBlock");
  expect(footer).toContain("footer-hands");
});

it("distinguishes SOL and wrapped SOL labels while sharing the official Solana mark", () => {
  for (const symbol of ["SOL", "WSOL", "USDC"]) {
    const html = renderToStaticMarkup(<TokenAmountInput id="amount" label="Amount" symbol={symbol} />);
    expect(html).toContain(`${symbol}</span>`);
    expect(html).toContain(`/brand/ecosystem/${symbol === "USDC" ? "usdc" : "solana"}.svg`);
  }
  expect(renderToStaticMarkup(<TokenAmountInput id="amount" label="Amount" symbol="USD" />)).not.toContain("ecosystem-icon");
});
