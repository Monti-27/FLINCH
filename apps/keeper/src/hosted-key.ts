import { mkdtemp, writeFile, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Keypair, PublicKey } from "@solana/web3.js";
import { KeeperError } from "./runtime/errors.ts";

export async function hostedKey(env: NodeJS.ProcessEnv) {
  const secret = env.FLINCH_KEEPER_SECRET;
  delete env.FLINCH_KEEPER_SECRET;
  if (!secret) return { path: env.FLINCH_KEEPER_KEYPAIR_FILE, close: async () => {} };
  if (env.FLINCH_KEEPER_EXECUTE !== "true" || env.FLINCH_KEEPER_KEYPAIR_FILE || !env.FLINCH_KEEPER_PAYER
    || Buffer.byteLength(secret) > 4096) throw new KeeperError("invalid_config");
  let bytes: Uint8Array | undefined;
  let directory: string | undefined;
  let path: string | undefined;
  try {
    const value: unknown = JSON.parse(secret);
    if (!Array.isArray(value) || value.length !== 64 || !value.every(byte => Number.isInteger(byte) && byte >= 0 && byte <= 255)) {
      throw new KeeperError("invalid_keypair");
    }
    bytes = Uint8Array.from(value);
    value.fill(0);
    const wallet = Keypair.fromSecretKey(bytes);
    if (!wallet.publicKey.equals(new PublicKey(env.FLINCH_KEEPER_PAYER))) throw new KeeperError("invalid_keypair");
    directory = await mkdtemp(join(tmpdir(), "flinch-keeper-"));
    path = join(directory, "payer.json");
    await writeFile(path, JSON.stringify(Array.from(bytes)), { mode: 0o600, flag: "wx" });
    const keyPath = path;
    const keyDirectory = directory;
    return { path: keyPath, close: async () => { await unlink(keyPath); await rmdir(keyDirectory); } };
  } catch {
    if (path) await unlink(path).catch(() => undefined);
    if (directory) await rmdir(directory).catch(() => undefined);
    throw new KeeperError("invalid_keypair");
  } finally { bytes?.fill(0); }
}
