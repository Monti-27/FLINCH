# Railway hosting

## SELL timing release, 2026-09-11

The current web deployment is `5ab1001c-eb9e-4eca-bfd6-ee37dd3d20db`, SUCCESS at 06:12:50 UTC. The keeper is `a6afe85e-d21d-49c0-bc44-7fa76a81af8c`, SUCCESS at 05:50:39 UTC. The keeper received the shared-client timing correction; the later web-only release additionally invalidates quotes after a position revision. No program or infrastructure configuration changed in this release.

Final upload snapshot `flinch-railway-TiUvjU` matches production-tested snapshot `flinch-railway-MVnPxp`. Its manifest SHA-256 is `a26a51df4988e56429c2c6775c726dff0ea76b0706ccc9f2db219bbde20e4cf4`. Read-only SSH confirmed that manifest and all 286 uploaded file hashes on the exact web deployment. Two manifest-listed non-runtime backup files, `apps/web/src/app/globals.css.bak` and `apps/web/src/styles/tokens.css.bak`, were excluded by Railway ignore rules; there were no content mismatches. Earlier core deployment `368ff559-3a24-49c5-91d7-d486354c6af8` and the current keeper matched all 288 hashes of `flinch-railway-WYe6Tg`. Do not treat the final manifest as 288 uploaded files; align the snapshot allowlist with ignore rules in a separate release-tooling change.

Hosted smoke `railway-smoke-1789107234043` passes enabled Devnet health, running keeper, private database connection, live reference feed, navigation, wallet picker, rules, invalid-room handling, responsive layouts, reload and logo-to-landing-top behavior, without signing or page errors. The existing unrelated staged `FLINCH` service creation remains untouched. TESTING records the signing-game outcomes and recovered partial runs; health alone is not a full-gameplay certification.

Final hosted browser game `devnet-browser-LvPXtO` passes on these exact deployments: four deposits, three first-click SELLs and real Raydium swaps, four exact withdrawals, four base session revocations and empty vaults. The direct-wallet sell approval was delayed seven seconds. Reload, cancellation and claim during a browser-only ER outage passed. No local Devnet keeper ran. This uses genuine Devnet transactions with synthetic Wallet Standard adapters, not installed wallet extensions; a new ten-round soak and the broader release gates were not rerun.

`hosted-proof.json` independently verifies ten keeper transactions, three swaps and three base returns from twenty PostgreSQL transitions at 06:33:51 UTC. Read-only database inspection found one keeper lease owner and no pending journals. Final Railway state shows the exact web/keeper deployments online with one running replica each and PostgreSQL online. The historical keeper failure and unused legacy Redis warning remain distinct from current FLINCH health. All earlier partial test rooms were fully claimed and their session tokens revoked.

## Live services

The existing BlitzMine application services were reused for FLINCH in Satvik's Railway workspace. PostgreSQL and its original data were retained. The CLI directory link points to production and `flinch-web`.

| Component | Service | Address or purpose |
| --- | --- | --- |
| Frontend | `flinch-web` | https://flinch.up.railway.app |
| Keeper backend | `flinch-keeper` | https://flinch-keeper.up.railway.app/health |
| PostgreSQL | Existing `Postgres` | Private network; isolated `flinch` database |
| Legacy Redis | Existing `Redis` | Retained for BlitzMine recovery; FLINCH does not use it |

Project: `faab688f-6c36-46c1-921f-a379851d470f` (`incredible-friendship`). Production environment: `a8e640c0-d26f-43dc-a8c9-9f4bc715a39e`.

The public frontend domain was renamed from `flinch-game.up.railway.app` to `flinch.up.railway.app` on 2026-09-11. Private hostnames are now `flinch.railway.internal` for web and `flinch-keeper.railway.internal` for the keeper. The keeper's public health domain is unchanged. The frontend uses a service-variable reference for its private backend URL; it must be redeployed after a private-host rename so the running environment receives the new value. Old public links do not redirect automatically; generate new invites on the new origin. Historical evidence retains the actual origin used for each run.

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

After the networking rename, the read-only plan reports one keeper networking update because its current graph omits the keeper private endpoint. Dedicated private-network status nevertheless reports `flinch-keeper.railway.internal` ACTIVE, and web health confirms the private connection works. The desired graph contains the correct new name. The discrepancy's cause is not established; no IaC apply or keeper replacement was performed to resolve it.

`FLINCH_KEEPER_URL` on web references the keeper's private Railway domain and port. Only the server health route uses it. The web service has no keeper key or database credentials. Its health requires the backend to be running with transactions enabled and PostgreSQL connected; a healthy standby container is not gameplay readiness. The keeper materializes its sealed key into an owner-only temporary file, verifies its public identity and removes the file at shutdown.

The isolated database checks use the existing `flinch_test_runner` account, never `flinch_app`. `tests/keeper/hosted-check.ts --test-database` reads the test connection URL from stdin. Do not pass credentials as command arguments or store them in this repository. The production account intentionally cannot connect to `flinch_test`.

Old custom Railway JSON paths were cleared. Do not recreate deprecated `railway.json` files. Generated public domains stay managed in Railway, outside the authoring file.

## Devnet RPC gateway

The web server exposes `/api/rpc`, forwarding allowlisted Solana methods to Helius Devnet. `FLINCH_HELIUS_API_KEY` is a server-only Railway variable; never prefix it with `NEXT_PUBLIC_`, put it in a URL used by clients, or commit it. `FLINCH_RPC_ORIGIN` is the exact public web origin. Both `NEXT_PUBLIC_FLINCH_BASE_RPC` and keeper `FLINCH_BASE_RPC` use `https://flinch.up.railway.app/api/rpc`. MagicBlock placement discovery and ER requests are unchanged.

During migration, `NEXT_PUBLIC_FLINCH_PREVIOUS_BASE_RPC` and `FLINCH_PREVIOUS_BASE_RPC` contain `https://rpc.magicblock.app/devnet`. These explicit allowlists permit read-only reconciliation of older journal signatures through the new genesis-verified base connection. They do not rewrite journals, resend transactions, change ER routing, or contact the old base endpoint.

Only overlapping identical reads are shared; completed observations are never cached. Signed submissions and simulations are forwarded separately and never retried by the gateway. Requests are capped at 16 KiB, responses at 2 MiB, queue delay at one second, and upstream work at four seconds including queue time. The five-second client deadline is unchanged. Per-process request spacing is 125 ms, scoped account scans 250 ms, and signed submissions 1100 ms. Queue exhaustion returns 429. One web replica is required for these rate bounds; multiple independent processes would need a shared limiter.

This is a public, rate-bounded Devnet proxy, not an authenticated endpoint. Browser origin checks and program/pool/validator-scoped discovery reduce misuse but cannot prevent non-browser clients from consuming credits. Helius Free currently allows 1 million monthly credits, 10 RPC requests/s, 5 program scans/s and 1 transaction submission/s. A standard call costs one credit and a program scan costs ten. The existing two-second keeper discovery loop alone can consume about 432,000 credits per day when left running continuously. Free-tier hosting is therefore suitable for limited demo sessions, not unlimited always-on operation; four-player capacity must be measured separately. No paid upgrade or billing change is authorized.

Deploy the web gateway first and verify Devnet identity, program account reads and real decoded room discovery before moving the keeper. Follow exact deployment IDs to SUCCESS and then require keeper `running`, not merely `standby`. Do not accept the unrelated staged `FLINCH` service creation to deploy these existing services. The IaC file preserves the gateway variable names; no infrastructure plan is applied.

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

### Helius migration on 2026-09-11

Web `ecaf7cdb-f3c2-4b88-b262-27d50483acc6` reached SUCCESS at 02:57 UTC; keeper `042a73e6-9f40-43f7-b9f6-7f98397eba1c` reached SUCCESS at 03:00 UTC and logged ready at 03:01 UTC. Both running containers match all 287 manifest hashes from source snapshot `flinch-railway-mcLxIY`. The new keeper reports running with PostgreSQL connected. Read-only journal checks found three superseded records and no pending submissions before and after replacement. The separate staged FLINCH service creation was not accepted.

The new base gateway answers correct Devnet genesis, executable program, balance, scoped discovery and decoded room reads from the Mac and Railway. Discovery returns zero active rooms; the 22 raw matching accounts are historical. Hosted smoke `artifacts/runs/railway-smoke-1789095681991/result.json` passes, including live market data, wallet picker, rules, navigation, responsive layouts and logo-to-landing-top behavior. `artifacts/runs/helius-room-1789095642659/result.json` passes four simultaneous spectator pages reading a real completed room, reload and mobile layout, with 18 successful gateway responses and no page errors. The exact Helius credential was absent from all 38 checked public HTML/JavaScript resources.

Local checks pass 495 web, 56 client, 36 keeper and 29 harness tests, root/web/keeper type checks and an isolated production build. Two database integration tests were skipped; live database verification in this release was read-only. Source/comment/size and selected secret/generated-artifact checks passed. No new signing game, complete sell/claim cycle, extension-wallet test or ten-round soak was performed after this provider change. Earlier gameplay evidence is not a new-provider certification. No paid tier or billing changes were made.

### Source refresh on 2026-09-11

Frontend release `115baa8c-ec1d-4a74-95f1-de056dc57d38` reached `SUCCESS` at 02:21 UTC. Source snapshot `/var/folders/bj/02y4hg4n1bdbnr2s893rsh240000gn/T/flinch-railway-OT7YL0` was created at 02:16:52 UTC from commit `bf242febaf0fc5a809d029b0a3f5184c6723955c`. Read-only SSH verified all 284 release-manifest hashes in that exact running deployment. Automatic quotes, network recovery, timer changes and the header logo link are now in the live frontend.

Hosted smoke `artifacts/runs/railway-smoke-1789093559118/result.json` passes health, Devnet configuration, private backend/database connectivity, real market data, navigation, rules, wallet picker, invalid-room handling, reload and 1280/768/375px layouts. The logo returns to `/` at scroll position zero from both the arena and a scrolled landing page. No page errors or signing occurred. Earlier post-release smoke `railway-smoke-1789093317207` also passed. Local release checks passed 485 web, 55 client, 36 keeper and 29 harness tests; two PostgreSQL-specific tests were skipped. Root/web/keeper type checks and the isolated frontend production build passed.

The same snapshot was uploaded to the keeper as `75d98ad1-e787-4c9f-a957-47ff91abd418`, but it reached `FAILED` at 02:25 UTC after startup health checks failed. Prior deployment `5e489458-e878-4f5c-adef-dd78ea57e53a` remains online, reports `running`, and retains its PostgreSQL connection. The backend source refresh is incomplete. No database reset, RPC configuration change, program upgrade or second signing keeper was performed.

Read-only diagnostics from Railway reproduced `getAccountInfo` timeouts for both the program and payer on `https://rpc.magicblock.app/devnet` and `https://api.devnet.solana.com`, including with a 12-second diagnostic deadline. The configured endpoint answered `getGenesisHash` with the correct Devnet identity and `getBalance` successfully. A successful program-account check is required before the keeper opens its health server; this prerequisite currently fails. Logs show repeated room-discovery errors before and after the attempted release. Separate `getProgramAccounts` diagnostics timed out with the default five-second deadline, bounded retries and a 20-second diagnostic deadline. PostgreSQL had no pending journal submissions, but the unreadable catalog means the number of active rooms is unknown.

These observations establish an RPC-read blocker, not its upstream cause. Healthy HTTP endpoints do not prove discovery or gameplay works. Before recording, require working account reads and discovery, a successful keeper refresh with running ownership, and an authorized live game check. Do not bypass network/program checks, silently change RPC providers or widen production deadlines to force deployment. The full signing cycle and ten-round soak were not rerun. Release evidence is `artifacts/runs/railway-release-20260911-0219/result.json`.

### Earlier hosting evidence

After the domain rename, frontend redeployment `629d985f-8e28-4618-899c-6042b5f7b64b` reached SUCCESS and refreshed the private backend URL without uploading local source. New-origin smoke `artifacts/runs/railway-smoke-1789088402278/result.json` passes health, live market data, navigation, rules, wallet picker, invalid-room handling, reload and 1280/768/375px layouts, with no page errors or signing. Both private endpoints and the public frontend domain report ACTIVE. Frontend type check, 374-module source scan and 731-file selected artifact/secret scan pass. Earlier full-round evidence below was not rerun during this networking-only change.

Activation deployments `1073095c-e9db-43d2-b0d4-a096dca216bf` (web) and `584fee1e-d250-4a67-b7c5-dfd113045448` (keeper) reached `SUCCESS`. Replacement keeper `5e489458-e878-4f5c-adef-dd78ea57e53a` also reached `SUCCESS`, returned to `running`, and retained the completed game's exact journal. No active rooms were discovered before replacement. Original pre-activation source and variable snapshots are in owner-only `/Users/montisaini/.config/flinch/railway-activation-sHOMJO`.

The hosted lease test passed mutual exclusion, clean transfer and owner cancellation after its database session was terminated. Journal integration tests passed persistence and concurrent-replacement rejection. Both tests used only `flinch_test`; an initial attempt using the production role was correctly denied and its test helper was corrected without expanding permissions.

Enabled public smoke `railway-smoke-1789083145919` passed at 1280/768/375px with no page errors. Public asset check `hosted-bundle-8cMurt` found none of the eight actual private-key arrays or selected credential patterns across 21 loaded HTML/JavaScript resources. This is not a comprehensive security audit. The deployed production build, 462 web tests, 42 client tests, 36 keeper unit tests, 29 harness tests, 35 domain tests and separate two-test live database suite passed. Root/web/keeper type checks and source/artifact checks pass. Earlier hosting-only evidence follows.

Frontend deployment `bb01c559-9217-49d5-b2d9-7cb26e53e659` and corrected keeper deployment `2afd51fe-ad9b-47b7-9ef2-a1e568b702cc` reached `SUCCESS`. The initial database test found JSON double encoding; an explicit postgres.js JSON parameter fixed it. Live persistence/concurrent-replacement tests passed against `flinch_test`.

A pending test journal was written before restarting the backend container, recovered by a new process afterward, and removed from the isolated test database. The backend returned healthy with PostgreSQL connected after the restart. Evidence is retained in the private backup directory as `flinch-hosting-prepare.txt` and `flinch-hosting-verify.txt`. Both old BlitzMine public domains returned 404.

Public smoke: `artifacts/runs/railway-smoke-1789080216079`, repeated after the backend restart at `railway-smoke-1789080569457`, with no page errors or signing attempts. Root, frontend and keeper type checks, 34 keeper unit tests, 452 web tests, 360-module source-size/comment checks and selected secret/artifact scans passed. The frontend production build passed on Railway.

This is a Devnet demonstration, not a production or mainnet release. No further funding is currently needed: after hosted play the keeper held 0.185398360 devnet SOL and the deployer held 5.877644920, observed at slot 496387728. Real extension-wallet testing, warm-session revocation/expiry propagation, induced public committer faults and dependency-advisory review remain separate gates in DEVNET and SECURITY. Do not infer those checks from the successful hosted round, browser-only outage or database lease test.
