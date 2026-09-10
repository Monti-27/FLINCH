import { appendFileSync, mkdirSync } from "node:fs";
import { resolve, relative } from "node:path";
import anchor from "@coral-xyz/anchor";
import type { LiteSVM, TransactionMetadata } from "litesvm";
import type { PublicKey } from "@solana/web3.js";

export function observations(svm: LiteSVM, keys: PublicKey[]) {
  if (!process.env.FLINCH_EVIDENCE_DIR) return [];
  return keys.map(key => {
    const account = svm.getAccount(key);
    return { address: key.toBase58(), account: account && { owner: account.owner.toBase58(),
      lamports: account.lamports.toString(), executable: account.executable,
      dataBase64: Buffer.from(account.data).toString("base64") } };
  });
}

export function recordTransaction(meta: TransactionMetadata, succeeded: boolean, before: unknown, after: unknown) {
  const configured = process.env.FLINCH_EVIDENCE_DIR;
  if (!configured) return;
  const directory = resolve(configured);
  const root = resolve("artifacts/runs");
  const path = relative(root, directory);
  if (!path || path.startsWith("..") || resolve(root, path) !== directory) throw new Error("Evidence must use a run directory inside artifacts/runs");
  mkdirSync(directory, { recursive: true });
  const item = { runtime: "local-litesvm", syntheticPoolAndReturnedControl: true,
    signature: anchor.utils.bytes.bs58.encode(Buffer.from(meta.signature())), succeeded,
    logs: meta.logs(), before, after };
  appendFileSync(resolve(directory, `transactions-${process.pid}.jsonl`), JSON.stringify(item) + "\n");
}
