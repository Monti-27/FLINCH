import { cp, mkdir, mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { setTimeout } from "node:timers/promises";

const root = resolve(import.meta.dirname, "..");
const project = "faab688f-6c36-46c1-921f-a379851d470f";
const environment = "a8e640c0-d26f-43dc-a8c9-9f4bc715a39e";
const services = { web: "537363f3-32ee-4ef7-8bbd-4087d91d83c9", keeper: "d803ccaa-f495-4668-8aed-aa2e602a0e7c" };
const target = process.argv[2];
if (!["prepare", "web", "keeper", "all"].includes(target)) throw new Error("Use prepare, web, keeper or all");
const release = await mkdtemp(resolve(tmpdir(), "flinch-railway-"));
const paths = ["package.json", "bun.lock", "tsconfig.json", ".railwayignore", "packages/client", "apps/keeper/src",
  "apps/keeper/package.json", "apps/keeper/tsconfig.json", "apps/web/src", "apps/web/public", "apps/web/package.json",
  "apps/web/tsconfig.json", "apps/web/next.config.ts", "apps/web/postcss.config.mjs", "tests/keeper", "scripts/generate-brand-assets.mjs"];
for (const path of paths) {
  await mkdir(resolve(release, path, ".."), { recursive: true });
  await cp(resolve(root, path), resolve(release, path), { recursive: true, errorOnExist: true, force: false,
    filter: source => !source.split("/").includes("node_modules") });
}
const files = [];
async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error("Release cannot include symbolic links");
    if (entry.isDirectory()) { await inspect(path); continue; }
    const name = relative(release, path);
    if (/(?:^|\/)\.env|keypair.*\.json$|\.log$/.test(name)) throw new Error("Private or generated file in release");
    const contents = await readFile(path);
    if (/-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----|\[\s*(?:\d{1,3}\s*,\s*){63}\d{1,3}\s*\]/.test(contents.toString())) {
      throw new Error("Possible key material in release");
    }
    files.push({ path: name, sha256: createHash("sha256").update(contents).digest("hex") });
  }
}
await inspect(release);
await writeFile(resolve(release, "release-manifest.json"), JSON.stringify({ createdAt: new Date().toISOString(), files }, null, 2));
console.log(`Release snapshot: ${release}`);
async function railway(args) {
  const child = spawn("railway", args, { cwd: root, stdio: ["ignore", "pipe", "inherit"] });
  let output = "";
  child.stdout.on("data", chunk => { output += chunk; });
  return new Promise((done, reject) => {
    child.once("error", reject);
    child.once("exit", code => code === 0 ? done(output) : reject(new Error("Railway command failed")));
  });
}
async function deploy(name) {
  const scope = ["--project", project, "--environment", environment, "--service", services[name]];
  const output = await railway(["up", release, "--path-as-root", ...scope, "--detach", "--json", "-m", "Deploy FLINCH"]);
  const uploaded = output.trim().split("\n").map(line => { try { return JSON.parse(line); } catch { return {}; } })
    .find(value => value.deploymentId);
  if (!uploaded) throw new Error(`No deployment ID returned for ${name}; inspect Railway before retrying`);
  console.log(`${name}: uploaded ${uploaded.deploymentId}`);
  const deadline = Date.now() + 20 * 60_000;
  let previous;
  while (Date.now() < deadline) {
    const deployments = JSON.parse(await railway(["deployment", "list", ...scope, "--limit", "20", "--json"]));
    const deployment = deployments.find(value => value.id === uploaded.deploymentId);
    if (!deployment) throw new Error(`${name}: uploaded deployment missing; inspect Railway before retrying`);
    if (deployment.status !== previous) console.log(`${name}: ${deployment.status}`);
    previous = deployment.status;
    if (previous === "SUCCESS") return { service: name, deploymentId: uploaded.deploymentId, status: previous };
    if (!["QUEUED", "INITIALIZING", "WAITING", "BUILDING", "DEPLOYING"].includes(previous)) {
      throw new Error(`${name}: deployment ${uploaded.deploymentId} ended with ${previous}`);
    }
    await setTimeout(10_000);
  }
  throw new Error(`${name}: deployment ${uploaded.deploymentId} did not finish within 20 minutes; inspect before retrying`);
}
if (target !== "prepare") {
  const results = await Promise.all((target === "all" ? ["keeper", "web"] : [target]).map(deploy));
  await writeFile(resolve(release, "deployment-results.json"), JSON.stringify(results, null, 2));
  console.log("Railway deployments succeeded. Run the hosted smoke test to verify live behavior.");
}
