# FLINCH

Sell first. Pay the holders.

Four players stake equal WSOL in a timed game of chicken. A successful seller pays a small WSOL penalty to the remaining holders and receives the actual USDC proceeds from a Solana swap. MagicBlock handles live sell intents; custody, swaps, and claims stay on Solana.

## Status

The shared footer now uses the supplied video's actual ASCII hands, smooth inward entrances and a continuous color flow around a persistent Flinch × MagicBlock identity. See [reference provenance and motion](docs/FOOTER.md) and [validation](docs/TESTING.md).

The landing page at `/` follows the latest video references: pale ruled sections, word-by-word reveals, a licensed mountain landscape, one animated five-card bento and native FAQ. The earlier rule-card grid is removed. The rollup illustration shows intent, batch and return while Solana custody stays fixed. Unknown routes show an interactive pixel garden with working home and arena links. The existing dark game is at `/play`; valid old `/?room=…` invitations still open it. The landing and 404 do not start wallet, RPC or market-feed providers. The landing reuses the shared full-width footer without adding another. See [landing direction and provenance](docs/LANDING_PAGE.md) and [validation evidence](docs/TESTING.md).

The real-sales protocol core is implemented in `programs/flinch-v2`, backed by a dependency-free Rust domain library. A real local MagicBlock stack has completed four deposits, two ER sell batches, control returns, actual Raydium swaps, and four claims. A second run also proved expiry without penalties followed by redelegation, retry, and claims. Neither run injected Control state.

The shared generated-IDL client and permissionless keeper are implemented in separate workspace packages. A standalone CLI now provides read-only inspection, explicitly enabled execution, owner-only key loading, a single-process journal lock and graceful restart. Local client/keeper runs have completed real swaps, expiry/retry, four claims and repeated worker reconstruction. Recovery does not wait for ER status or Control decoding. Unknown transactions are reconciled, not blindly re-signed. See [keeper operation and restart limits](docs/KEEPER_OPERATIONS.md).

Additional local fault tests now prove two independent keepers racing the same settlements without duplicate swaps, and revocation of a warm ER session followed by direct-wallet sales and all four claims. These checks retain failed transaction metadata and unchanged-state assertions, not just happy-path signatures. They do not establish hosted revocation timing or exhaustive race coverage; see TESTING for exact scope.

Delayed-commit tests also block actual ER-to-base commitment writes through expiry and hard recovery. Late fills reject, expiry charges no penalty, and recovery preserves earlier USDC proceeds plus holder WSOL even before Control returns. Four claims complete in both cases. The harness suite now has 18 tests; the default browser round and production UI regressions pass. No protocol or UI changes were needed for these fault scenarios. See TESTING for their exact scope and retained evidence.

Verified locally: 35 domain tests in debug/release, 23 executed runtime tests, 10 harness tests, 29 client tests, 28 keeper tests, 169 web unit tests, 18 legacy regressions and the replacement program-ID test. The full validation gate passed during the interactive sandbox work. Four independent browser wallets complete four UI deposits, three actual local Raydium swaps and all claims, including pasted room invites and keeper pause/resume. The separate critical browser scenario covers reload, session revocation, base/ER read outages and explicit quote expiry followed by deliberate refresh. Separate-process tests cover pending-execute restart and base recovery through an injected ER transport outage. See [validation evidence and limits](docs/TESTING.md), including retained layout failures, an unresolved historical intermittent preflight rejection and toolchain warnings.

Executable integer quotes and a modular Next.js frontend are implemented. Quote output matches actual Raydium execution for both mint orientations and all creator-fee modes. Browser tests have completed room creation, session-backed funding, quoted SELL, reload, settlement, claims and base session revocation through a test Wallet Standard adapter signing real local transactions. Web transactions default off.

Settled positions now use one withdrawal ticket with full-precision token amounts, primary claim controls and expandable fee details. Scoped feedback blocks duplicate preparation and keeps uncertain transactions distinct from completed withdrawals. A real local browser claim remains usable during an injected MagicBlock read failure. See TESTING for the latest four-browser and production-UI evidence; this is not public devnet or ordinary-extension proof.

The frontend uses a Collect UI-inspired game table: four desktop player positions, a focused action column beside a bounded reference chart, contained exact-string amount entry, a paired WSOL/USDC sell ticket and pale indigo controls. Mobile puts actions before the chart. The user's exact palette, approved split F, self-hosted Space Grotesk/Manrope, official ecosystem icons and full-width Waves footer remain; the footer is unchanged. Compact player disclosure uses explicit touch/keyboard controls; empty-seat clicks focus entry without submitting. Scoped Zustand and a single Sonner host remain. KLineCharts 10.0.3 supplies native candles, observed volume and fullscreen in an action-aligned layout; see [chart integration](docs/CHART.md). Coinbase SOL/USD is reference-only; executable SELL estimates still come from Raydium. Read the [design study](docs/UI_DESIGN.md) and [frontend architecture](docs/FRONTEND.md) for sources, validation and limits.

No hosted keeper service, funded devnet pool, public FLINCH deployment, or ten-round devnet proof exists yet. Local liquidity and mint state are synthetic. Dependency advisories and remaining fault tests block release. The legacy `programs/flinch` is preserved separately and must not be deployed as real-sales FLINCH. This is not a production-ready release.

## Start here

The approved split F is integrated as a shared SVG across the site, with matching browser and Apple touch icons. Read [brand.md](brand.md) for canonical geometry, responsive placement and asset-generation instructions.

1. [Execution plan](docs/BUILD_PLAN.md)
2. [Decisions and defaults](docs/DECISIONS.md)
3. [Game rules](docs/GAME_RULES.md)
4. [Architecture](docs/ARCHITECTURE.md)
5. [MagicBlock and SDK integration](docs/MAGICBLOCK.md)
6. [Program boundary](docs/PROGRAM.md)
7. [Validation gates](docs/TESTING.md)
8. [Current handoff](docs/LLM_HANDOFF.md)

Historical docs are preserved in [docs/legacy](docs/legacy/README.md). Research HTML and report-source.md predate this migration and are not implementation specifications.

## Structure

```text
crates/flinch-domain/     pure accounting, batches, timing, ledger tests
programs/flinch-v2/       replacement custody, control, sessions and Raydium CPI
programs/flinch/          legacy Anchor program pending migration
idls/                    reviewed Raydium interface and provenance
tests/local/             in-process SBF authorization and token-flow tests
tests/stack/             real local base/ER handoffs, swaps, expiry and claims
packages/client/         generated-IDL builders, routing, exact units and observations
apps/keeper/             decisions, reconciliation, durable journal and bounded workers
apps/web/                lobby, wallet/session lifecycle, match, claims and receipt proof
docs/                    current contracts and implementation gates
docs/legacy/             superseded specifications, preserved for reference
scripts/                 bounded validation entrypoints
```

See the [client and keeper contract](docs/CLIENT_KEEPER.md) for runtime separation and storage limits, [quotes](docs/QUOTES.md) for executable estimates and [frontend](docs/FRONTEND.md) for browser setup. Local liquidity fixtures never enter application packages.

## Verify

Run `bun install --frozen-lockfile --ignore-scripts`, then `bash scripts/fetch-raydium.sh` for the hash-checked read-only devnet binary download. Run `bash scripts/verify-v2.sh` for the local build and tests. Run `bun run test:stack` and `bun run test:stack:expiry` separately for real local base/ER cycles. See [toolchain and evidence instructions](docs/TESTING.md) before running the stack.

Devnet WSOL and Circle USDC have no monetary value. Test-pool quotes are not mainnet SOL/USD prices. Mainnet, Git initialization, publication, liquidity funding, and deployment remain separately authorized actions.

Run `bun run web` for the read-only browser preview. Run `bun run test:stack:quotes` and `bun run test:stack:quotes:expiry` separately for quote-backed local rounds. `bun run test:browser:stack` runs the full local browser scenario; see TESTING for the required local validator PATH and browser executable.

Run `bun run test:browser:ui` against `/play` on the loopback preview for chart controls, native dialog keyboard behavior, reduced motion, offline recovery and explicit feed-outage coverage. Run `bun run test:browser:landing` for the landing's responsive, scroll, contrast, keyboard, no-JavaScript and route checks.

For an explicitly enabled local test world, use `bun run local --execute-local` with the prerequisites in [LOCAL_PLAY](docs/LOCAL_PLAY.md). It runs gameplay on port 3400 with manual public-wallet funding and room watching. Each launch creates a new local genesis; ordinary extension-wallet support remains unverified. `bun run test:browser:local` exercises four separate browser wallets through deposits, three sales and all claims.
