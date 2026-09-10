import { createHash } from "node:crypto";
import { appendFileSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Connection, PublicKey } from "@solana/web3.js";
import { programBinary, programIdl, raydiumBinary } from "../local/support/artifacts.ts";

export function journal(directory: string, name: string, value: unknown) {
  appendFileSync(resolve(directory, `${name}.jsonl`), JSON.stringify({ observedAt: new Date().toISOString(), value }) + "\n", { mode: 0o600 });
}

export function result(directory: string, value: unknown) {
  writeFileSync(resolve(directory, "result.json"), JSON.stringify(value, null, 2), { mode: 0o600 });
}

export async function snapshot(connection: Connection, keys: PublicKey[]) {
  const accounts = await connection.getMultipleAccountsInfo(keys, "confirmed");
  return accounts.map((account, i) => ({ address: keys[i].toBase58(), account: account && {
    owner: account.owner.toBase58(), lamports: account.lamports.toString(), executable: account.executable,
    dataBase64: account.data.toString("base64") } }));
}

export function sourceManifest() {
  const paths = ["Cargo.toml", "Cargo.lock", "rust-toolchain.toml", "package.json", "bun.lock", "tsconfig.json",
    "packages/client/package.json", "apps/keeper/package.json",
    programBinary, programIdl, raydiumBinary];
  for (const directory of ["crates/flinch-domain", "programs/flinch-v2", "packages/client/src", "packages/client/generated", "apps/keeper/src", "tests", "scripts", "idls", "tools/local"]) {
    paths.push(...readdirSync(directory, { recursive: true, withFileTypes: true })
      .filter(entry => entry.isFile()).map(entry => resolve(entry.parentPath, entry.name)));
  }
  return paths.sort().map(path => ({ path, sha256: createHash("sha256").update(readFileSync(path)).digest("hex") }));
}
