import { createServer } from "node:http";
import { once } from "node:events";
import { connection, verifyNetwork, DEVNET_PROGRAM_ID } from "@flinch/client";
import { PostgresOperationStore } from "./postgres-store.ts";
import { hostedConfig } from "./hosted-config.ts";
import { runKeeper } from "./runtime/service.ts";
import { errorCode } from "./runtime/errors.ts";
import { hostedKey } from "./hosted-key.ts";
import { acquireHostedLease } from "./hosted-lease.ts";

const abort = new AbortController();
let stopping = false;
const stop = () => { stopping = true; abort.abort(); };
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
const report = (event: Record<string, unknown>) => process.stdout.write(JSON.stringify({ time: new Date().toISOString(), ...event }) + "\n");
let store: PostgresOperationStore | undefined;
let server: ReturnType<typeof createServer> | undefined;
let keeper = "starting";
let key: Awaited<ReturnType<typeof hostedKey>> | undefined;
let lease: Awaited<ReturnType<typeof acquireHostedLease>> | undefined;
try {
  key = await hostedKey(process.env);
  const { config, execute, port, databaseUrl } = hostedConfig({ ...process.env, FLINCH_KEEPER_KEYPAIR_FILE: key.path });
  store = new PostgresOperationStore(databaseUrl);
  await store.migrate();
  if (execute) {
    const base = connection(config.baseUrl, config.network);
    await verifyNetwork(base, config.network, config.expectedGenesis);
    const program = await base.getAccountInfo(DEVNET_PROGRAM_ID, "confirmed");
    if (!program?.executable) throw new Error("Devnet program is not deployed");
    if (await base.getBalance(config.payer!, "confirmed") < 10_000_000) throw new Error("Keeper fee reserve is insufficient");
  }
  keeper = execute ? "starting" : "disabled";
  const database = store;
  server = createServer(async (request, response) => {
    if (request.url !== "/health" || !["GET", "HEAD"].includes(request.method ?? "")) {
      response.writeHead(404).end();
      return;
    }
    let connected = true;
    try { await database.health(); } catch { connected = false; }
    const healthy = connected && !abort.signal.aborted && keeper !== "failed";
    response.writeHead(healthy ? 200 : 503, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify({ service: "flinch-keeper", healthy, database: connected ? "connected" : "unavailable",
      keeper, network: "devnet", transactionsEnabled: execute, program: DEVNET_PROGRAM_ID.toBase58() }));
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 10_000;
  server.listen(port, "0.0.0.0");
  await once(server, "listening");
  report({ event: "hosting_ready", keeper, port, storage: "postgresql" });
  if (execute) {
    keeper = "standby";
    lease = await acquireHostedLease(databaseUrl, abort);
    await runKeeper(config, true, event => {
      if (event.event === "ready") keeper = "running";
      report({ ...event });
    }, abort.signal, store);
    if (abort.signal.aborted && !stopping) throw abort.signal.reason;
  }
  else if (!abort.signal.aborted) await once(abort.signal, "abort");
} catch (error) {
  if (!stopping) {
    keeper = "failed";
    report({ event: "fatal", code: errorCode(error) });
    process.exitCode = 1;
  }
} finally {
  abort.abort();
  if (server) await new Promise<void>(done => server!.close(() => done()));
  await lease?.close();
  await store?.close();
  await key?.close();
  process.removeListener("SIGINT", stop);
  process.removeListener("SIGTERM", stop);
}
