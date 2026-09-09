import { cp, mkdir, mkdtemp, readdir, realpath, symlink, readFile, open } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { DEVNET } from "./settings.ts";
import { probeDevnet } from "./probe.ts";
import { writePrivate } from "./private-files.ts";
import { json } from "./operations.ts";

export async function buildWeb(directory: string, enableTransactions = false) {
  const preflight = await probeDevnet(directory);
  if (enableTransactions && !preflight.deployed) throw new Error("Verify deployment before enabling frontend transactions");
  await mkdir("artifacts/runs", { recursive: true });
  const release = await mkdtemp(resolve("artifacts/runs/devnet-web-"));
  const web = resolve(release, "apps/web");
  await mkdir(web, { recursive: true });
  await mkdir(resolve(release, "packages/client"), { recursive: true });
  for (const name of ["package.json", "bun.lock"]) await cp(resolve(name), resolve(release, name), { errorOnExist: true, force: false });
  for (const name of ["src", "public", "package.json", "next.config.ts", "postcss.config.mjs", "tsconfig.json"])
    await cp(resolve("apps/web", name), resolve(web, name), { recursive: true, errorOnExist: true, force: false });
  for (const name of ["src", "generated", "package.json"])
    await cp(resolve("packages/client", name), resolve(release, "packages/client", name), { recursive: true, errorOnExist: true, force: false });
  await symlink(resolve("node_modules"), resolve(release, "node_modules"), "dir");
  await mkdir(resolve(web, "node_modules/@flinch"), { recursive: true });
  await symlink(resolve(release, "packages/client"), resolve(web, "node_modules/@flinch/client"), "dir");
  for (const name of await readdir("apps/web/node_modules")) {
    if (name === "@flinch") continue;
    await symlink(await realpath(resolve("apps/web/node_modules", name)), resolve(web, "node_modules", name), "dir");
  }
  const environment = { NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_FLINCH_NETWORK: "devnet",
    NEXT_PUBLIC_FLINCH_BASE_RPC: preflight.baseUrl, NEXT_PUBLIC_FLINCH_GENESIS: DEVNET.genesis,
    NEXT_PUBLIC_FLINCH_POOL: DEVNET.pool.toBase58(), NEXT_PUBLIC_FLINCH_VALIDATOR: DEVNET.validator.toBase58(),
    NEXT_PUBLIC_FLINCH_ENABLE_TRANSACTIONS: String(enableTransactions), NEXT_PUBLIC_FLINCH_LOCAL_ER: "" };
  await writePrivate(resolve(release, "configuration.json"), json({ environment, program: preflight.program, programHash: preflight.binary.sha256 }));
  const log = await open(resolve(release, "build.log"), "wx", 0o600);
  try {
    const child = spawn(process.execPath, [resolve(web, "node_modules/next/dist/bin/next"), "build", "--webpack"],
      { cwd: web, env: { ...process.env, ...environment }, stdio: ["ignore", log.fd, log.fd] });
    await new Promise<void>((done, reject) => { child.once("error", reject); child.once("exit", code => code === 0 ? done() : reject(new Error(`Frontend build failed; inspect ${release}/build.log`))); });
  } finally { await log.close(); }
  await writePrivate(resolve(release, "result.json"), json({ complete: true, network: "devnet", transactions: enableTransactions, program: preflight.program }));
  return release;
}

export async function serveWeb(release: string) {
  const location = await realpath(release);
  const result = JSON.parse(await readFile(resolve(location, "result.json"), "utf8"));
  const config = JSON.parse(await readFile(resolve(location, "configuration.json"), "utf8"));
  if (result.complete !== true || result.network !== "devnet" || config.program !== DEVNET.program.toBase58()) throw new Error("Not a completed devnet frontend build");
  const child = spawn(process.execPath, [resolve(location, "apps/web/node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", "3500"],
    { cwd: resolve(location, "apps/web"), env: { ...process.env, ...config.environment }, stdio: "inherit" });
  const stop = () => child.kill("SIGTERM");
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
  try { await new Promise<void>((done, reject) => { child.once("error", reject); child.once("exit", code => code === 0 || code === null ? done() : reject(new Error("Devnet frontend stopped"))); }); }
  finally { process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop); }
}

if (process.argv[1] === import.meta.filename) {
  try {
    const args = process.argv.slice(2);
    if (args.length === 2 && args[0] === "--serve") await serveWeb(args[1]);
    else if ((args.length === 2 || args.length === 3 && args[2] === "--enable-transactions") && args[0] === "--directory")
      console.log(`Devnet frontend release: ${await buildWeb(args[1], args[2] === "--enable-transactions")}`);
    else throw new Error("Use --directory PRIVATE_PATH [--enable-transactions] or --serve RELEASE_PATH");
  } catch (error) { console.error(error instanceof Error ? error.message : "Frontend preparation failed"); process.exitCode = 1; }
}
