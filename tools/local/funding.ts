import { PublicKey, SystemProgram } from "@solana/web3.js";
import { endpoint, prepareTransaction, submitTransaction, transactionStatus, verifyNetwork } from "../../packages/client/src/index.ts";
import type { Submission } from "../../packages/client/src/index.ts";
import type { Stack } from "../../tests/stack/bootstrap.ts";
import { walletSigner, captureTransaction } from "../../tests/stack/client.ts";
import { journal } from "../../tests/stack/evidence.ts";
import { poll } from "../../tests/stack/rpc.ts";

type Grant = Submission & { status: "pending" | "confirmed" | "failed" };

export class LocalFunding {
  private readonly grants = new Map<string, Grant>();
  private readonly active = new Set<string>();
  private readonly stack: Stack;
  private readonly genesis: string;
  constructor(stack: Stack, genesis: string) { endpoint(stack.base.rpcEndpoint, "localnet"); this.stack = stack; this.genesis = genesis; }

  async fund(wallet: PublicKey) {
    const address = wallet.toBase58();
    if (wallet.equals(PublicKey.default) || !PublicKey.isOnCurve(wallet) || wallet.equals(this.stack.host.publicKey)) throw new Error("Expected an independent wallet public key");
    if (this.active.has(address)) throw new Error("Funding is already being checked for this wallet");
    this.active.add(address);
    try {
      await verifyNetwork(this.stack.base, "localnet", this.genesis);
      const previous = this.grants.get(address);
      if (previous) {
        if (previous.status === "pending") {
          const state = await transactionStatus(this.stack.base, previous.signature);
          if (state.kind !== "pending") previous.status = state.kind;
        }
        return { address, ...previous, repeated: true };
      }
      if (this.grants.size + [...this.active].filter(key => !this.grants.has(key)).length > 16) throw new Error("Local wallet funding limit reached");
      const prepared = await prepareTransaction(this.stack.base, [SystemProgram.transfer({ fromPubkey: this.stack.host.publicKey,
        toPubkey: wallet, lamports: 1_000_000_000n })], walletSigner([this.stack.host]), "legacy");
      const grant: Grant = { ...prepared.submission, status: "pending" };
      this.grants.set(address, grant);
      journal(this.stack.directory, "local-funding", { address, lamports: "1000000000", ...grant });
      await submitTransaction(this.stack.base, prepared);
      await poll("local wallet funding confirmation", async () => {
        const state = await transactionStatus(this.stack.base, grant.signature);
        if (state.kind === "pending") return;
        grant.status = state.kind;
        if (state.kind === "failed") throw new Error("Local funding transaction failed; do not repeat automatically");
        return true;
      });
      await captureTransaction(this.stack, this.stack.base, grant.signature, "explicit local wallet grant");
      journal(this.stack.directory, "local-funding", { address, lamports: "1000000000", ...grant });
      return { address, ...grant, repeated: false };
    } finally { this.active.delete(address); }
  }
}
