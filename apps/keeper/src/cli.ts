import { readConfig } from "./runtime/config.ts";
import { errorCode, KeeperError } from "./runtime/errors.ts";
import { inspectKeeper, runKeeper } from "./runtime/service.ts";

const args = process.argv.slice(2);
const report = (event: Readonly<Record<string, unknown>>) => { process.stdout.write(JSON.stringify({ time: new Date().toISOString(), ...event }) + "\n"); };
const abort = new AbortController();
const stop = () => abort.abort();
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
try {
  if (args.length === 1 && args[0] === "--help") {
    process.stdout.write("FLINCH keeper\n\nInspect: node apps/keeper/src/cli.ts inspect --config /absolute/config.json\nRun: node apps/keeper/src/cli.ts run --config /absolute/config.json --execute\n\nExecution spends keeper transaction fees. Localnet and devnet only.\n");
  } else {
    const [command, flag, path, execute] = args;
    if (!path || flag !== "--config" || !(command === "inspect" && args.length === 3
      || command === "run" && args.length === 4 && execute === "--execute")) throw new KeeperError("invalid_arguments");
    const config = await readConfig(path);
    if (command === "inspect") await inspectKeeper(config, report, abort.signal);
    else await runKeeper(config, true, report, abort.signal);
  }
} catch (error) {
  if (abort.signal.aborted && error === abort.signal.reason) report({ event: "stopped" });
  else { report({ event: "fatal", code: errorCode(error) }); process.exitCode = 1; }
} finally {
  process.removeListener("SIGINT", stop);
  process.removeListener("SIGTERM", stop);
}
