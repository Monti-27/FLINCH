import { mkdtemp, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { privateDirectory, writePrivate } from "./private-files.ts";
import { hash } from "./program-data.ts";

export async function stageRelease(directory: string, expected: { bytes: number; sha256: string }) {
  const location = await privateDirectory(directory);
  const binary = await readFile(resolve(location, "build/flinch_v2.so"));
  if (binary.length !== expected.bytes || hash(binary) !== expected.sha256) throw new Error("Build changed after preflight");
  const release = await mkdtemp(resolve(location, "release-"));
  const path = resolve(release, "flinch_v2.so");
  await writePrivate(path, binary);
  await writePrivate(resolve(release, "manifest.json"), JSON.stringify(expected, null, 2));
  return path;
}
