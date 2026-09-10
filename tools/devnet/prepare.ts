import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { DEVNET, devnetEndpoint } from "./settings.ts";
import { ensureKey, privateDirectory, writePrivate } from "./private-files.ts";
import { readBoundedFile } from "../../apps/keeper/src/runtime/files.ts";

export async function prepareDevnet(directory: string) {
  const location = await privateDirectory(directory);
  const build = resolve(location, "build");
  await mkdir(build, { recursive: true, mode: 0o700 });
  await privateDirectory(build);
  const program = await ensureKey(resolve(build, "flinch_v2-keypair.json"), resolve("target/deploy/flinch_v2-keypair.json"), DEVNET.program);
  const deployer = await ensureKey(resolve(location, "deployer.json"));
  const keeper = await ensureKey(resolve(location, "keeper.json"));
  const buffer = await ensureKey(resolve(location, "buffer.json"));
  const players = [];
  for (let seat = 0; seat < 4; seat++) players.push(await ensureKey(resolve(location, `player-${seat}.json`)));
  const configuration = { version: 1, network: "devnet", baseUrl: devnetEndpoint(), expectedGenesis: DEVNET.genesis,
    rooms: [], discovery: { pool: DEVNET.pool.toBase58(), validator: DEVNET.validator.toBase58() },
    journalDirectory: resolve(location, "journal"), keypairFile: resolve(location, "keeper.json"), payer: keeper.toBase58(), concurrency: 4, messageVersion: "v0" };
  const publicIdentity = { program: program.toBase58(), deployer: deployer.toBase58(), keeper: keeper.toBase58(), buffer: buffer.toBase58(), players: players.map(key => key.toBase58()) };
  for (const [name, value] of [["keeper-config.json", JSON.stringify(configuration, null, 2)], ["identity.json", JSON.stringify(publicIdentity, null, 2)]]) {
    try { await writePrivate(resolve(location, name), value); }
    catch (error) {
      if (!error || typeof error !== "object" || !("code" in error) || error.code !== "EEXIST") throw error;
      if ((await readBoundedFile(resolve(location, name), 65536, true)).toString("utf8") !== value) throw new Error("Existing devnet configuration differs; review before reusing keys");
    }
  }
  return publicIdentity;
}

if (process.argv[1] === import.meta.filename) {
  try {
    if (process.argv.length !== 4 || process.argv[2] !== "--directory") throw new Error("Usage: prepare.ts --directory /absolute/private/path");
    console.log(JSON.stringify(await prepareDevnet(process.argv[3]), null, 2));
  } catch { console.error("Devnet key preparation failed. Check the explicit path, ownership and existing public identities. No transaction was submitted."); process.exitCode = 1; }
}
