# Railway hosting

## Live services

The existing BlitzMine application services were reused for FLINCH in Satvik's Railway workspace. PostgreSQL and its original data were retained. The CLI directory link points to production and `flinch-web`.

| Component | Service | Address or purpose |
| --- | --- | --- |
| Frontend | `flinch-web` | https://flinch-game.up.railway.app |
| Keeper backend | `flinch-keeper` | https://flinch-keeper.up.railway.app/health |
| PostgreSQL | Existing `Postgres` | Private network; isolated `flinch` database |
| Legacy Redis | Existing `Redis` | Retained for BlitzMine recovery; FLINCH does not use it |

Project: `faab688f-6c36-46c1-921f-a379851d470f` (`incredible-friendship`). Production environment: `a8e640c0-d26f-43dc-a8c9-9f4bc715a39e`.

The public site is an **enabled experimental Devnet game**. `NEXT_PUBLIC_FLINCH_ENABLE_TRANSACTIONS=true` and `FLINCH_KEEPER_EXECUTE=true`. Only dedicated keeper `33sxC2jXiptFfxoGgP52qEjDvpdGksZPmN6ZHTBfYMJ8` is supplied through a sealed secret. The deployment/upgrade-authority key stays outside Railway. The local Devnet keeper was drained and stopped before activation, with no pending submissions and its journal preserved. Do not start a second local signing keeper against this scope.

Public-browser evidence is `artifacts/runs/devnet-browser-J3INdz`: four UI deposits, three actual Raydium swaps, four exact withdrawals, session and wallet signing, reload, cancelled approvals, quote expiry, four base session revocations and a claim during a browser-only ER outage. Both vaults finished empty. `hosted-proof.json` independently verifies ten keeper transactions and three base returns from the PostgreSQL history. `hosted-restart.json` verifies all twenty history transitions survived replacement unchanged. These use synthetic Wallet Standard adapters signing real Devnet transactions, not installed Trust Wallet or Phantom extensions.

## PostgreSQL's role

Solana remains authoritative for stakes, balances, swaps and claims. PostgreSQL stores the keeper's durable operation journal so pending transaction signatures and recovery state survive container replacement. It never invents a confirmation or acts as a wallet ledger.

The backend creates `keeper_journals` and its pending-room index on startup. Per-room database locks serialize history changes; replay validation rejects replacing an uncertain operation. A separate reserved PostgreSQL session holds the hosted keeper lease. A replacement waits in standby; loss of the lease aborts the old worker, and graceful shutdown drains work before releasing ownership. Keep one replica. This coordinates hosted instances using the same database, not independently operated keepers or local file journals; onchain replay protection remains necessary.

`flinch_app` owns only the new `flinch` database. It has no superuser, role-creation or database-creation privileges, and no read/write privileges on BlitzMine's original tables. `DATABASE_URL` is sealed. The original `railway` database was not reset or migrated. `flinch_test` is a separate integration-test database; `flinch_backup_check` contains the verified backup restoration.

## Update the deployment

From the repository root:

```sh
bun run --cwd apps/keeper typecheck
bun run test:keeper
bun run --cwd apps/web typecheck
bun run --cwd apps/web test
bun run railway:deploy
bun run railway:smoke --active
```

Use `bun run railway:web` or `bun run railway:keeper` for one component. `bun run railway:prepare` creates a snapshot without uploading.

The release script copies allowlisted source into a fresh temporary directory, rejects private files and key material, records hashes, and uploads with explicit project/service/environment IDs. It follows each returned deployment ID until `SUCCESS`, failing on another terminal state or a 20-minute timeout. The live smoke test checks health, real Coinbase data, landing-to-arena navigation, room validation, chart controls, wallet-picker opening, responsive layout and reload. Pass `--active` for the enabled deployment; it never signs.

The test needs Playwright Chromium installed, or a compatible `FLINCH_BROWSER_EXECUTABLE`. On this Mac:

```sh
FLINCH_BROWSER_EXECUTABLE='/Users/montisaini/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' bun run railway:smoke --active
```

The old `Monti-27/BlitzMine` GitHub connections were disconnected. Releases use local snapshots, not automatic GitHub pushes. The FLINCH remote exists, but hosting changes must be reviewed and committed before connecting it for automatic deployment. This task did not commit or push concurrent changes.

## Configuration

Both services build from the monorepo root with Railpack, Bun 1.3.14 and Node 24.14.1. Installation uses `bun install --frozen-lockfile --ignore-scripts`. Each has one Singapore replica, no sleep, a 120-second health-check window, 30-second draining and five on-failure restarts. Both bind to `0.0.0.0:$PORT` on port 8080.

| Service | Build | Start | Health |
| --- | --- | --- | --- |
| Web | `bun run --cwd apps/web build` | `bun run --cwd apps/web start:railway` | `/api/health` |
| Keeper | `bun run --cwd apps/keeper typecheck` | `node apps/keeper/src/hosted.ts` | `/health` |

The imported [.railway/railway.ts](../.railway/railway.ts) preserves secrets, activation settings and the private backend reference. It does not deploy source. Its repository-less `github` source types preserve metadata left by disconnected services; neither is connected to BlitzMine. CLI 5.49.6 and SDK 3.11.0 were used. The no-change plan predates activation; review a fresh exact infrastructure plan before applying it. No IaC apply was needed here.

`FLINCH_KEEPER_URL` on web references the keeper's private Railway domain and port. Only the server health route uses it. The web service has no keeper key or database credentials. Its health requires the backend to be running with transactions enabled and PostgreSQL connected; a healthy standby container is not gameplay readiness. The keeper materializes its sealed key into an owner-only temporary file, verifies its public identity and removes the file at shutdown.

The isolated database checks use the existing `flinch_test_runner` account, never `flinch_app`. `tests/keeper/hosted-check.ts --test-database` reads the test connection URL from stdin. Do not pass credentials as command arguments or store them in this repository. The production account intentionally cannot connect to `flinch_test`.

Old custom Railway JSON paths were cleared. Do not recreate deprecated `railway.json` files. Generated public domains stay managed in Railway, outside the authoring file.

## Backup and rollback

Before stopping BlitzMine, source at deployed commit `98374f19ae4276cfce11a89714089bb32944ef29`, configuration, variables, deployment histories and a PostgreSQL dump were saved in:

`/Users/montisaini/.config/flinch/blitzmine-backup-G4PRiH`

This owner-only directory contains secrets. Never upload it or add it to Git. The initial custom-format dump was successfully restored into `flinch_backup_check`. A second export was captured after shutdown.

An additional Redis RDB export is retained as `blitzmine-redis-final.rdb`; Redis had zero keys at export. The native Redis snapshot is listed with no expiry, but its used-size field remains unavailable, so the independent RDB is retained as well.

Locked Railway snapshots named `BlitzMine before FLINCH`:

- PostgreSQL: `eefbbc8a-afb8-423d-8824-6d13538938c8`.
- Redis: `1b05b3b8-a902-4370-8ba8-c6d2315330fa`.

BlitzMine's running deployments were removed, not its services or data. Domains `blitzmine.up.railway.app` and `blitz-mine.up.railway.app` were replaced with FLINCH domains. Existing PostgreSQL and Redis volumes remain.

Rollback needs a separately approved cutover: stop FLINCH applications, restore backed-up BlitzMine configuration/domains and deploy the archived source. Its untouched `railway` database is the first recovery candidate. Never restore the whole PostgreSQL volume over FLINCH data. If necessary, restore a dump into a separate database and validate it before switching traffic.

## Verification and limits

Activation deployments `1073095c-e9db-43d2-b0d4-a096dca216bf` (web) and `584fee1e-d250-4a67-b7c5-dfd113045448` (keeper) reached `SUCCESS`. Replacement keeper `5e489458-e878-4f5c-adef-dd78ea57e53a` also reached `SUCCESS`, returned to `running`, and retained the completed game's exact journal. No active rooms were discovered before replacement. Original pre-activation source and variable snapshots are in owner-only `/Users/montisaini/.config/flinch/railway-activation-sHOMJO`.

The hosted lease test passed mutual exclusion, clean transfer and owner cancellation after its database session was terminated. Journal integration tests passed persistence and concurrent-replacement rejection. Both tests used only `flinch_test`; an initial attempt using the production role was correctly denied and its test helper was corrected without expanding permissions.

Enabled public smoke `railway-smoke-1789083145919` passed at 1280/768/375px with no page errors. Public asset check `hosted-bundle-8cMurt` found none of the eight actual private-key arrays or selected credential patterns across 21 loaded HTML/JavaScript resources. This is not a comprehensive security audit. The deployed production build, 462 web tests, 42 client tests, 36 keeper unit tests, 29 harness tests, 35 domain tests and separate two-test live database suite passed. Root/web/keeper type checks and source/artifact checks pass. Earlier hosting-only evidence follows.

Frontend deployment `bb01c559-9217-49d5-b2d9-7cb26e53e659` and corrected keeper deployment `2afd51fe-ad9b-47b7-9ef2-a1e568b702cc` reached `SUCCESS`. The initial database test found JSON double encoding; an explicit postgres.js JSON parameter fixed it. Live persistence/concurrent-replacement tests passed against `flinch_test`.

A pending test journal was written before restarting the backend container, recovered by a new process afterward, and removed from the isolated test database. The backend returned healthy with PostgreSQL connected after the restart. Evidence is retained in the private backup directory as `flinch-hosting-prepare.txt` and `flinch-hosting-verify.txt`. Both old BlitzMine public domains returned 404.

Public smoke: `artifacts/runs/railway-smoke-1789080216079`, repeated after the backend restart at `railway-smoke-1789080569457`, with no page errors or signing attempts. Root, frontend and keeper type checks, 34 keeper unit tests, 452 web tests, 360-module source-size/comment checks and selected secret/artifact scans passed. The frontend production build passed on Railway.

This is a Devnet demonstration, not a production or mainnet release. No further funding is currently needed: after hosted play the keeper held 0.185398360 devnet SOL and the deployer held 5.877644920, observed at slot 496387728. Real extension-wallet testing, warm-session revocation/expiry propagation, induced public committer faults and dependency-advisory review remain separate gates in DEVNET and SECURITY. Do not infer those checks from the successful hosted round, browser-only outage or database lease test.
