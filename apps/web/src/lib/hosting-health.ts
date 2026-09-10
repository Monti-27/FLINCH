export async function hostingHealth(env: Readonly<Record<string, string | undefined>>, request: typeof fetch = fetch) {
  const transactionsEnabled = env.NEXT_PUBLIC_FLINCH_ENABLE_TRANSACTIONS === "true";
  const result = { service: "flinch-web", healthy: true, network: env.NEXT_PUBLIC_FLINCH_NETWORK ?? "devnet",
    transactionsEnabled, backend: "not_configured", database: "unknown" };
  if (!env.FLINCH_KEEPER_URL) return { ...result, healthy: !env.RAILWAY_PROJECT_ID };
  try {
    const url = new URL(env.FLINCH_KEEPER_URL);
    if (url.protocol !== "http:" || !url.hostname.endsWith(".railway.internal") || url.username || url.password
      || url.pathname !== "/" || url.search || url.hash) throw new Error("Invalid backend address");
    const response = await request(new URL("/health", url), { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(4000) });
    const backend = await response.json();
    const healthy = response.ok && backend.service === "flinch-keeper" && backend.healthy === true && backend.network === result.network
      && backend.database === "connected" && (!transactionsEnabled || (backend.transactionsEnabled === true && backend.keeper === "running"));
    return { ...result, healthy, backend: healthy ? "connected" : "unavailable", database: backend.database === "connected" ? "connected" : "unavailable" };
  } catch { return { ...result, healthy: false, backend: "unavailable", database: "unknown" }; }
}
