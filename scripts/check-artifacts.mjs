import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import assert from "node:assert/strict";

const root = resolve(import.meta.dirname, "..");
const excluded = new Set(["node_modules", "target", "artifacts/runs", ".git"]);
const paths = [];
function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    const local = relative(root, path);
    if (excluded.has(local) || ["node_modules", ".next", "test-results", "playwright-report"].includes(entry.name) || entry.isSymbolicLink()
      || entry.name === "next-env.d.ts" || entry.name.endsWith(".tsbuildinfo")) continue;
    if (entry.isDirectory()) walk(path);
    else paths.push(path);
  }
}
walk(root);

const findings = [];
const keypair = /\[\s*(?:\d{1,3}\s*,\s*){63}\d{1,3}\s*\]/;
const credential = /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----|(?:api[_-]?key|secret[_-]?key|mnemonic)\s*[:=]\s*["'][A-Za-z0-9+/ =_-]{24,}["']/i;
for (const path of paths) {
  const local = relative(root, path);
  if (/\.(so|log|ledger)$|keypair.*\.json$|(?:^|\/)\.env(?:\.|$)/i.test(local) && !local.endsWith(".env.example")) findings.push({ path: local, kind: "generated or private configuration" });
  const text = readFileSync(path, "utf8");
  if (keypair.test(text) || credential.test(text)) findings.push({ path: local, kind: "possible secret" });
}
assert.equal(findings.length, 0, JSON.stringify(findings));
console.log(`Checked ${paths.length} project files for selected secret patterns and unexpected generated artifacts`);
