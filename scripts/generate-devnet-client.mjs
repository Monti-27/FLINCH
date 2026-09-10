import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PublicKey } from "@solana/web3.js";

const source = process.argv[2];
if (!source || !source.startsWith("/")) throw new Error("Pass an explicit devnet build directory");
const local = JSON.parse(readFileSync("packages/client/generated/idl.json", "utf8"));
const next = JSON.parse(readFileSync(resolve(source, "flinch_v2.json"), "utf8"));
const target = new PublicKey("8mGLM6MoGgJBfJXAESN5C5fmKXCwnfinDGXX8drPFEie");
const from = Array.from(new PublicKey(local.address).toBytes());
const rebind = value => {
  if (value === local.address) return target.toBase58();
  if (Array.isArray(value)) return value.length === 32 && value.every((byte, index) => byte === from[index]) ? Array.from(target.toBytes()) : value.map(rebind);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, rebind(child)]));
  return value;
};
if (JSON.stringify(next) !== JSON.stringify(rebind(local))) throw new Error("Devnet contract changed beyond program identity");
const destination = "packages/client/generated/devnet.json";
const contents = readFileSync(resolve(source, "flinch_v2.json"), "utf8");
if (process.argv[3] === "--check") {
  if (readFileSync(destination, "utf8") !== contents) throw new Error("Stale devnet client contract");
} else writeFileSync(destination, contents);
