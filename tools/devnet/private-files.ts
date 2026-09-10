import { constants } from "node:fs";
import { mkdir, lstat, realpath, open } from "node:fs/promises";
import { resolve, relative, isAbsolute, sep } from "node:path";
import { Keypair } from "@solana/web3.js";
import type { PublicKey } from "@solana/web3.js";
import { readBoundedFile } from "../../apps/keeper/src/runtime/files.ts";

export async function privateDirectory(path: string) {
  if (!isAbsolute(path) || path === "/") throw new Error("An explicit private directory outside the repository is required");
  await mkdir(path, { recursive: true, mode: 0o700 });
  const actual = await realpath(path);
  const inside = relative(await realpath(resolve(import.meta.dirname, "../..")), actual);
  const stat = await lstat(path);
  if (actual !== resolve(path) || !stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0 || stat.uid !== process.getuid?.()
    || !inside || (inside !== ".." && !inside.startsWith(`..${sep}`) && !isAbsolute(inside))) throw new Error("Unsafe private directory");
  return actual;
}

export async function writePrivate(path: string, value: string | Uint8Array) {
  const file = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try { await file.writeFile(value); await file.sync(); } finally { await file.close(); }
}

export async function readKey(path: string, expected?: PublicKey) {
  const buffer = await readBoundedFile(path, 4096, true);
  try {
    const data: unknown = JSON.parse(buffer.toString("utf8"));
    if (!Array.isArray(data) || data.length !== 64 || !data.every(v => Number.isInteger(v) && v >= 0 && v <= 255)) throw new Error("Invalid private key file");
    const bytes = Uint8Array.from(data);
    data.fill(0);
    try {
      const key = Keypair.fromSecretKey(bytes.slice());
      if (expected && !key.publicKey.equals(expected)) throw new Error("Private key identity differs");
      return key;
    } finally { bytes.fill(0); }
  } finally { buffer.fill(0); }
}

export async function ensureKey(path: string, source?: string, expected?: PublicKey) {
  try { return (await readKey(path, expected)).publicKey; }
  catch (error) { if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") throw error; }
  const key = source ? await readKey(source, expected) : Keypair.generate();
  try { await writePrivate(path, JSON.stringify(Array.from(key.secretKey))); }
  catch (error) { if (!error || typeof error !== "object" || !("code" in error) || error.code !== "EEXIST") throw error; }
  return (await readKey(path, expected)).publicKey;
}
