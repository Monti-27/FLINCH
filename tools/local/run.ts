import { createInterface } from "node:readline";
import { startSandbox } from "./sandbox.ts";
import { parseCommand } from "./commands.ts";

const help = { commands: ["fund WALLET", "watch ROOM", "pause ROOM", "status", "help", "quit"],
  funding: "One synthetic local SOL grant per wallet, up to 16 wallets. No faucet or public network.",
  watch: "Watch each room after creating it in the UI. The keeper starts it once all four deposits confirm.",
  safety: "Never paste private keys. Stopping this sandbox ends its local test world; restarting creates a new genesis." };
const report = (event: string, value: unknown) => process.stdout.write(JSON.stringify({ event, value }) + "\n");
const args = process.argv.slice(2);
if (args.length === 1 && args[0] === "--help") {
  report("help", help);
} else if (args.length !== 1 || args[0] !== "--execute-local") {
  report("error", { code: "local_execution_required", message: "Run bun run local --execute-local to start the loopback sandbox." });
  process.exitCode = 1;
} else {
  let sandbox: Awaited<ReturnType<typeof startSandbox>> | undefined;
  let input: ReturnType<typeof createInterface> | undefined;
  let stopping = false;
  const stop = () => { stopping = true; input?.close(); };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    sandbox = await startSandbox();
    void sandbox.failure.then(failure => {
      if (stopping) return;
      report("error", { code: "service_stopped", service: failure.service, exitCode: failure.code, signal: failure.signal,
        message: "A local service exited. Shutting down this test world; evidence is retained." });
      process.exitCode = 1;
      stop();
    });
    if (!stopping) {
      sandbox.check();
      report("ready", sandbox.info);
      report("help", help);
      input = createInterface({ input: process.stdin, crlfDelay: Infinity });
      for await (const line of input) {
        if (stopping) break;
        try {
          sandbox.check();
          const command = parseCommand(line);
          if (command.kind === "quit") { stop(); break; }
          if (command.kind === "help") report("help", help);
          else if (command.kind === "status") report("status", { ...sandbox.info, rooms: sandbox.rooms.status() });
          else if (command.kind === "fund") report("funding", await sandbox.funding.fund(command.address));
          else if (command.kind === "watch") report("watching", await sandbox.rooms.watch(command.address));
          else if (command.kind === "pause") report("paused", await sandbox.rooms.pause(command.address));
        } catch { report("error", { code: "command_failed", message: "Command was not completed. Check public addresses, status and retained evidence. Never repeat an uncertain transfer blindly." }); }
      }
    }
  } catch {
    report("error", { code: "sandbox_failed", message: "Local sandbox could not run. Check prerequisites and port availability in docs/LOCAL_PLAY.md." });
    process.exitCode = 1;
  } finally {
    stopping = true;
    input?.close();
    try { if (sandbox) { await sandbox.stop(); report("stopped", { temporaryKeysRemoved: true }); } }
    catch { report("error", { code: "shutdown_failed", message: "Inspect remaining local processes before starting again." }); process.exitCode = 1; }
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
  }
}
