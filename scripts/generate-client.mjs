import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const destination = resolve(root, "packages/client/generated");
mkdirSync(destination, { recursive: true });
const type = readFileSync(resolve(root, "target/types/flinch_v2.ts"), "utf8");
const start = type.indexOf("export type FlinchV2");
if (start < 0) throw new Error("Missing generated FlinchV2 type");
const files = new Map([
  ["types.ts", type.slice(start)],
  ["idl.json", readFileSync(resolve(root, "target/idl/flinch_v2.json"), "utf8")],
  ["raydium.json", readFileSync(resolve(root, "idls/raydium_cp_swap.json"), "utf8")],
]);
for (const [name, contents] of files) {
  if (process.argv.includes("--check")) {
    if (readFileSync(resolve(destination, name), "utf8") !== contents) throw new Error(`Stale client contract: ${name}`);
  } else writeFileSync(resolve(destination, name), contents);
}
