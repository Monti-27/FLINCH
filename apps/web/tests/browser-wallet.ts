import { VersionedTransaction } from "@solana/web3.js";
import { utils } from "@coral-xyz/anchor";
import type { Keypair } from "@solana/web3.js";
import type { Page } from "@playwright/test";

export async function browserWallet(page: Page, signer: Keypair, signed: (signature: string) => void = () => {}, beforeSign: () => Promise<void> = async () => {}) {
  await page.exposeFunction("flinchTestSign", async (bytes: number[]) => {
    await beforeSign();
    const transaction = VersionedTransaction.deserialize(new Uint8Array(bytes));
    transaction.sign([signer]);
    signed(utils.bytes.bs58.encode(transaction.signatures[0]));
    return Array.from(transaction.serialize());
  });
  await page.addInitScript(({ address, publicKey }) => {
    const account = { address, publicKey: new Uint8Array(publicKey), chains: ["solana:devnet"], features: ["solana:signTransaction"] };
    const listeners = new Set<(event: unknown) => void>();
    const wallet = { version: "1.0.0", name: "FLINCH local test wallet", icon: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=",
      chains: ["solana:devnet"], accounts: [] as unknown[], features: {
        "standard:connect": { version: "1.0.0", connect: async () => { wallet.accounts = [account]; listeners.forEach(listener => listener({ accounts: [account] })); return { accounts: [account] }; } },
        "standard:disconnect": { version: "1.0.0", disconnect: async () => { wallet.accounts = []; listeners.forEach(listener => listener({ accounts: [] })); } },
        "standard:events": { version: "1.0.0", on: (_event: string, listener: (event: unknown) => void) => { listeners.add(listener); return () => listeners.delete(listener); } },
        "solana:signTransaction": { version: "1.0.0", supportedTransactionVersions: ["legacy", 0], signTransaction: async (...inputs: { transaction: Uint8Array }[]) => {
          const sign = (window as unknown as { flinchTestSign: (bytes: number[]) => Promise<number[]> }).flinchTestSign;
          return Promise.all(inputs.map(async input => ({ signedTransaction: new Uint8Array(await sign(Array.from(input.transaction))) })));
        } }
      } };
    const register = (api: { register: (wallet: unknown) => void }) => api.register(wallet);
    window.addEventListener("wallet-standard:app-ready", event => register((event as CustomEvent).detail));
    window.dispatchEvent(new CustomEvent("wallet-standard:register-wallet", { detail: register }));
  }, { address: signer.publicKey.toBase58(), publicKey: Array.from(signer.publicKey.toBytes()) });
}
