import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

if (process.argv.length !== 3 || process.argv[2] !== "--test-database") {
  throw new Error("Explicit isolated database check required");
}
const input = readFileSync(0, "utf8").trim();
if (input.length > 4096) throw new Error("Invalid test database configuration");
const url = new URL(input);
if (url.pathname !== "/flinch_test" || decodeURIComponent(url.username) !== "flinch_test_runner") throw new Error("Unexpected test database scope");
const env: NodeJS.ProcessEnv = { ...process.env, FLINCH_TEST_DATABASE_URL: url.href };
delete env.DATABASE_URL;
delete env.FLINCH_KEEPER_SECRET;
const child = spawn(process.execPath, ["--test", "--test-concurrency=1", "tests/keeper/hosted-lease.integration.test.ts",
  "tests/keeper/postgres.integration.test.ts"], { stdio: "inherit", env });
child.once("error", () => { console.error("Database check process failed"); process.exitCode = 1; });
child.once("exit", code => { process.exitCode = code ?? 1; });
