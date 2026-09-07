import { realpath } from "node:fs/promises";
import { relative, resolve, isAbsolute, sep } from "node:path";
import { Keypair } from "@solana/web3.js";
import type { PublicKey } from "@solana/web3.js";
import type { TransactionSigner } from "@flinch/client";
import { readBoundedFile } from "./files.ts";
import { KeeperError } from "./errors.ts";

export async function loadSigner(path: string, expected: PublicKey): Promise<TransactionSigner> {
  const repository = await realpath(resolve(import.meta.dirname, "../../../.."));
  const location = await realpath(path);
  const within = relative(repository, location);
  if (!within || (within !== ".." && !within.startsWith(`..${sep}`) && !isAbsolute(within))) throw new KeeperError("unsafe_file");
  const buffer = await readBoundedFile(path, 4096, true);
  let bytes: Uint8Array | undefined;
  try {
    const value: unknown = JSON.parse(buffer.toString("utf8"));
    if (!Array.isArray(value) || value.length !== 64 || !value.every(byte => Number.isInteger(byte) && byte >= 0 && byte <= 255)) {
      throw new KeeperError("invalid_keypair");
    }
    bytes = Uint8Array.from(value);
    value.fill(0);
    const wallet = Keypair.fromSecretKey(bytes.slice());
    if (!wallet.publicKey.equals(expected)) throw new KeeperError("invalid_keypair");
    return { publicKey: wallet.publicKey, sign: async transaction => { transaction.sign([wallet]); return transaction; } };
  } catch { throw new KeeperError("invalid_keypair"); }
  finally { buffer.fill(0); bytes?.fill(0); }
}
