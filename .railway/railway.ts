import { defineRailway, postgres, preserve, project, redis, service, volume } from "railway/iac";

export default defineRailway(() => {
  const Redis = redis("Redis", { region: "asia-southeast1-eqsg3a" });
  Redis.deploy = { startCommand: "/bin/sh -c \"rm -rf $RAILWAY_VOLUME_MOUNT_PATH/lost+found/ && exec docker-entrypoint.sh redis-server --requirepass $REDIS_PASSWORD --save 60 1 --dir $RAILWAY_VOLUME_MOUNT_PATH\"" };
  Redis.networking = { privateNetworkEndpoint: "redis" };
  const Postgres = postgres("Postgres", { region: "asia-southeast1-eqsg3a" });
  Postgres.networking = { privateNetworkEndpoint: "postgres" };
  const postgresVolume = volume("postgres-volume", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "asia-southeast1-eqsg3a", sizeMB: 50000 });
  const redisVolume = volume("redis-volume", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "asia-southeast1-eqsg3a", sizeMB: 50000 });
  const flinchWeb = service("flinch-web", {
    source: { type: "github" },
    root: "/",
    build: "bun run --cwd apps/web build",
    start: "bun run --cwd apps/web start:railway",
    healthcheck: "/api/health",
    healthcheckTimeout: 120,
    preDeploy: [],
    replicas: { "asia-southeast1-eqsg3a": 1 },
    deploy: { drainingSeconds: 30, restartPolicyMaxRetries: 5 },
    networking: { privateNetworkEndpoint: "blitz-mine" },
    env: { FLINCH_KEEPER_URL: preserve(), NEXT_PUBLIC_FLINCH_BASE_RPC: preserve(), NEXT_PUBLIC_FLINCH_ENABLE_TRANSACTIONS: preserve(), NEXT_PUBLIC_FLINCH_GENESIS: preserve(), NEXT_PUBLIC_FLINCH_NETWORK: preserve(), NEXT_PUBLIC_FLINCH_POOL: preserve(), NEXT_PUBLIC_FLINCH_VALIDATOR: preserve(), NEXT_TELEMETRY_DISABLED: preserve(), NODE_ENV: preserve(), PORT: preserve(), RAILPACK_BUN_VERSION: preserve(), RAILPACK_INSTALL_CMD: preserve(), RAILPACK_NODE_VERSION: preserve(), RAILWAY_DEPLOYMENT_DRAINING_SECONDS: preserve() },
  });
  const flinchKeeper = service("flinch-keeper", {
    source: { type: "github" },
    root: "/",
    build: "bun run --cwd apps/keeper typecheck",
    start: "node apps/keeper/src/hosted.ts",
    healthcheck: "/health",
    healthcheckTimeout: 120,
    preDeploy: [],
    replicas: { "asia-southeast1-eqsg3a": 1 },
    deploy: { drainingSeconds: 30, restartPolicyMaxRetries: 5 },
    networking: { privateNetworkEndpoint: "blitzmine" },
    env: { DATABASE_URL: preserve(), FLINCH_BASE_RPC: preserve(), FLINCH_KEEPER_EXECUTE: preserve(), FLINCH_KEEPER_PAYER: preserve(), FLINCH_KEEPER_SECRET: preserve(), FLINCH_POOL: preserve(), FLINCH_VALIDATOR: preserve(), NEXT_TELEMETRY_DISABLED: preserve(), NODE_ENV: preserve(), PORT: preserve(), RAILPACK_BUN_VERSION: preserve(), RAILPACK_INSTALL_CMD: preserve(), RAILPACK_NODE_VERSION: preserve(), RAILWAY_DEPLOYMENT_DRAINING_SECONDS: preserve() },
  });

  return project("incredible-friendship", {
    resources: [Redis, Postgres, flinchWeb, flinchKeeper, postgresVolume, redisVolume],
  });
});
