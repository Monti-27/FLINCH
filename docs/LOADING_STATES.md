# Arena loading states

## Scope

The 2026-09-11 skeleton pass covers `/play` startup, initial room reads, reference-chart code and history, reference price, quote reserve reads and confirmed receipt reads. It does not change signing, token amounts, settlement, custody or network routing. Existing landing, footer, stake-control and timer work is preserved.

`components/ui/skeleton` owns decorative shapes and named busy regions. Its 2.2-second transform-only highlight sweeps left to right with a short quiet interval. Existing palette tokens supply the surface and highlight. Reduced motion disables the sweep, including when the preference changes while loading. No extra animation dependency or minimum loading duration is added.

## Sequence

1. The server renders the arena footprint immediately through the route fallback and Application startup fallback. The brand home link remains usable.
2. Runtime initialization replaces only that fallback. Room data, chart code and price history have independent loading states. No artificial reveal timer delays content or actions.
3. The chart renderer reports initialization separately from feed readiness. Exactly one plot skeleton covers code/history waits. It reserves the actual plot and axes; it never draws fictional candles or prices.
4. Room entry stays interactive during reference-feed loading. Known history stays visible through feed reconnects. Known receipts stay visible while a new revision is read, scoped to the same client and room.
5. A first quote read shows amount-shaped placeholders without a fabricated USDC estimate or queue action. Receipt placeholders never imply a confirmed swap.
6. Failures show the existing recovery controls, not an indefinite shimmer. Leaving a pending room read remains possible.

`ArenaLayout` is shared by live and loading composition. Skeletons reuse the current timer and stake-control geometry, including the ring, amount slider and presets. Compact screens use the collapsed player-bar footprint. Stable reference-price slots prevent height and wrapping changes between placeholders and animated numbers. The frontend and page-load skills guided layout reservation, independent loading boundaries and reduced-motion support; no entrance choreography or financial animation was added.

## Verification

Run `FLINCH_UI_URL=http://127.0.0.1:3521/play FLINCH_BROWSER_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node apps/web/tests/skeleton-browser.ts` against a current isolated production preview, adjusting the loopback port as needed.

The browser test retains actual Coinbase history before deliberately delaying its delivery, rather than inventing reference prices. It covers 320/375/768/1280/1920px layouts, chart-height parity, moving shimmer, usable stake presets, independent chart-code delay, feed failure/retry, live reduced-motion changes, server-only skeletons and leaving a pending room read. The room test deliberately aborts read requests; it does not create or fund a room or establish onchain success. Unit tests cover empty, pending, ready, failed and historical-refresh states, plus quote and receipt semantics.

No financial transaction, fresh Rust/SBF suite, local economic cycle, public devnet integration, ten-round soak, Safari/Firefox or physical-device performance check is claimed by this presentation-only pass. Existing release gates remain open. The funded port-3400 sandbox was not stopped or reset. Source before this pass is retained in `artifacts/runs/skeleton-before-RlRVbw/source.tar`; do not restore it over concurrent work.

## Retained evidence

- Final-source browser: `artifacts/runs/skeleton-1789073511545/result.json`. This includes the mobile timer-overlap regression, code-download delay and all loading/recovery assertions above.
- Isolated production browser: `skeleton-1789073289534/result.json`, before the final mobile grid containment fix. The production snapshot is `skeleton-preview-k7ri6C`; the final-source browser independently verifies the containment fix on the existing development server.
- A successful full-workspace snapshot passed 385 tests, both type checks, production build, 298-module source checks and the 629-file selected scan. Concurrent bento work changed afterward. The subsequent build compiled successfully but its type gate failed at `apps/web/tests/bento.test.tsx:19`, where `SceneState.complete` no longer exists. No bento files were edited by this task, and the earlier success does not validate those later changes.
- Earlier browser runs deliberately retained failed geometry assertions. They identified animated-number height, narrow price wrapping and the mobile headline grid, all addressed by the final-source browser pass. These are loading-layout failures, not protocol failures.
- Final follow-up at 02:25 IST: the concurrent bento type error cleared without edits from this task. The final source now passes the production build including its frontend type gate, all 385 web tests, the root type check, the 298-module source check and the 630-file selected scan. The earlier bento failure is retained as intermediate evidence, not a current blocker. The final-source browser evidence above covers this task's implementation; no broader transaction or release gate was rerun.
