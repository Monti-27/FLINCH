import postgres from "postgres";
import { setTimeout } from "node:timers/promises";

export async function acquireHostedLease(url: string, abort: AbortController) {
  let held = false;
  const sql = postgres(url, { max: 1, connect_timeout: 5, idle_timeout: 0, max_lifetime: null,
    onnotice: () => {}, onclose: () => { if (held) abort.abort(new Error("Keeper database lease lost")); },
    connection: { application_name: "flinch-keeper-lease", statement_timeout: 5000 } });
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let query: Promise<unknown> | undefined;
  const reserved = await sql.reserve().catch(async error => { await sql.end({ timeout: 1 }); throw error; });
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    if (heartbeat) clearInterval(heartbeat);
    await query?.catch(() => {});
    try { if (held && !abort.signal.aborted) await reserved`SELECT pg_advisory_unlock(1179404622, 2)`; }
    finally { held = false; reserved.release(); await sql.end({ timeout: 1 }); }
  };
  try {
    while (true) {
      abort.signal.throwIfAborted();
      const [row] = await reserved`SELECT pg_try_advisory_lock(1179404622, 2) AS held, pg_backend_pid() AS pid`;
      if (row.held === true) {
        held = true;
        heartbeat = setInterval(() => {
          if (query) return;
          query = Promise.resolve(reserved`SELECT 1`).catch(() => abort.abort(new Error("Keeper database lease lost")))
            .finally(() => { query = undefined; });
        }, 1000);
        abort.signal.throwIfAborted();
        return { close, pid: Number(row.pid) };
      }
      await setTimeout(250, undefined, { signal: abort.signal });
    }
  } catch (error) { await close(); throw error; }
}
