import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, isAbsolute } from "node:path";
import { createHash } from "node:crypto";

const release = process.env.FLINCH_TEST_DEVNET_BUILD;
if (release) assert(isAbsolute(release), "An absolute devnet build directory is required");
export const programBinary = resolve(release ?? "target/deploy", "flinch_v2.so");
export const programIdl = resolve(release ?? "target/idl", "flinch_v2.json");
export const programAddress = release ? "8mGLM6MoGgJBfJXAESN5C5fmKXCwnfinDGXX8drPFEie" : "JDQgyFxwZJUpA31y2qhqhGgwfm5k7zANYUY1ctkqPB9y";
export const raydiumBinary = resolve(release ? "target/raydium-8d479aa2.so" : "target/raydium-devnet.so");
export const raydiumHash = release ? "8d479aa24b5472687ab540a6c9e4581a36095c03b3c1575b515b38d5bfced0f1" : "c5ba03746795b128cdfb38af41bbef130dc6d38cff532e03b208c938a8787a82";

export function verifyArtifacts() {
  assert.equal(JSON.parse(readFileSync(programIdl, "utf8")).address, programAddress);
  assert.equal(createHash("sha256").update(readFileSync(raydiumBinary)).digest("hex"), raydiumHash);
}
