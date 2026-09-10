# Reference chart

## KLineCharts, 2026-09-11

The user requested KLineCharts and aligned trading controls. The arena uses the registry-verified stable `klinecharts` 10.0.3 package instead of `lightweight-charts` 5.2.1. The lockfile only adds KLineCharts and removes Lightweight Charts and its unused fancy-canvas dependency. Installation disabled lifecycle scripts. The Apache license, NOTICE and bundled Lightweight Charts license are retained at `/licenses/klinecharts.txt`.

Native candlesticks are the default, with volume off. The toolbar provides 1m/2m/5m, a native chart-style selector, reset and fullscreen. Candles, hollow rising candles, OHLC bars, a true unfilled line and a neutral mountain area all use the same observations. The plot is near-black, with neutral chrome and grid, teal/red candles and no blue gradient. Escape exits fullscreen and restores focus only after this chart exits; unsupported fullscreen is disabled and rejected requests report an inline error. Source disclosure also closes on Escape or focus departure. The renderer uses `ssr: false` because KLineCharts accesses `window` during import. Room controls and feed state render independently.

## Ownership

- `market-panel.tsx`: composition, feed lifecycle, toolbar, source disclosure and retry.
- `chart-options.ts` and `chart-style-select.tsx`: shared period/style contracts and a keyboard-accessible native selector.
- `market-chart.tsx`: initialization/disposal, period/style/volume, resizing and reset.
- `chart-theme.ts`: dedicated neutral chart tokens and native presentation styles, without price interpolation or animated price points.
- `chart-feed.ts`: data-loader contract, millisecond timestamps, frame-batched updates, complete multi-bar delivery, history replacement and bounded retention.
- `model.ts` and `store.ts`: validated Coinbase observations, not game accounting.
- `use-chart-fullscreen.ts`: fullscreen lifecycle and focus return.
- `chart-viewport.ts`: preserves the visible historical timestamp when retention or reconnection replaces the dataset.

Coinbase SOL/USD remains offchain reference data, not an executable Raydium quote or a verified MagicBlock oracle. Missing intervals are not fabricated. Historical volume comes from Coinbase; live volume counts only received ticker sizes and may be incomplete. The first live tick discards the overlapping current-minute historical volume rather than double counting it. Missing sizes remain unknown, including in aggregated candles; the volume indicator does not substitute zero. Reconnection clears an older header tick. No token balances, penalties, minimum outputs, signing or settlement were changed.

Style changes reuse the chart instance. Disposal removes store listeners and pending frames. Updates spanning multiple minute boundaries deliver every affected bar. Actual received ticks are batched to animation frames; no intermediate market prices are invented for animation. Two- and five-minute candles aggregate real one-minute observations into UTC-aligned buckets. Reconnection and rolling retention replace the bounded dataset while preserving a visible historical anchor when retained, or clamping to the earliest retained observation. No unimplemented pagination is advertised.

## Layout

Above 900px, actions and chart share top and bottom edges. The action column is 340px, or 320px at compact desktop widths; the canvas fills the remaining chart space. Nine-decimal stake strings stay visible. Below 901px, actions precede the chart. Toolbar controls stay on one row with at least 40px hit targets at 320px and above. The native style selector becomes an icon and chevron below a 560px panel width; its selected option remains accessible. Volume lives in the bottom utility row. Only chart semantic tokens change; the user's palette primitives and other surfaces are preserved.

The frontend design skill guided aligned edges, optical spacing, native controls, contrast and responsive checks. No footer or landing implementation was edited by the chart task; concurrent changes were preserved.

## Dark-chart verification

Production chart checks pass in `artifacts/runs/chart-dark-1789072685363/result.json`: all five styles, 1m/2m/5m, volume toggle, keyboard typeahead/focus, fullscreen/Escape, source disclosure, 320–1920px toolbar/plot containment, both desktop panel edges and action-first mobile order. Screenshots for every chart style and responsive width were reviewed. The check matches 350 closed candles exactly against a separate Coinbase request and records six actual WebSocket ticks. Reduced motion, explicit 503 history outage, working manual retry and offline recovery pass with no page errors. `chart-dark-1789072384715` is an earlier passing production run.

The focused market/viewport/contrast suite passes 99 tests. A whole-workspace snapshot passes 376 web tests in 36 files, both type checks, production build and source/artifact scans. Counts include concurrent work. No dependency change was made in this refinement. The production snapshot is isolated under `/tmp/flinch-chart-verified.9JVF2T`; the funded port-3400 process/genesis was not restarted.

The final chart-only rerun also passes directly on the preserved development sandbox: `artifacts/runs/chart-dark-1789072833383/result.json`. This includes the concurrent price-row stabilization. A subsequent whole-repo type check fails in actively edited landing bento scene icon sizes and outdated bento test state methods; no chart diagnostic appears. The earlier passing snapshot is not a claim that ongoing unrelated changes are currently type-clean. The temporary chart production listener was stopped; the funded sandbox remains running.

Browser testing exposed and fixed a canvas stacking issue blocking the feed retry button and explicit Escape handling for fullscreen. Earlier runs also caught a native-select keyboard-test assumption, a stale two-option interval assertion and concurrent build-output replacement; those are retained as failed iterations. Full UI smoke subsequently stops at a stale ecosystem-icon selector outside the chart in `ui-smoke-1789072478940`; no unrelated implementation or ecosystem test was changed.

The standalone chart layout check records document-relative coordinates rather than accepting scroll-dependent above-fold results. Both panel edges align, but the concurrent taller entry design puts Create below the 900px fold on desktop and at 320px. This is recorded, not certified as passing. Full-page composition, physical-device/Safari/Firefox checks and all protocol/devnet/ten-round release gates remain outside this chart proof. The source remains real offchain Coinbase data, not verified Solana onchain pricing.

## Original integration validation

The chart-scoped suite passes 46 tests across seven files, including fourteen new regressions. Both TypeScript checks, production build, source constraints and selected secret/artifact scan pass. The final full suite passes 269 tests in 29 files, including concurrent work. An intermediate run had three footer expectation failures after its parallel replacement; that task updated its tests and the final suite is green. No footer implementation or tests were changed by the chart task.

Direct in-app browser checks used the production build on loopback port 3410 and actual Coinbase data. Widths 320/375/768/1024/1280/1440/1920 pass overflow, exact-input visibility, single-row toolbar and 40px control checks. Desktop edges match; mobile actions come first; create controls remain above the 900px fold. Candle/line/period/volume switching, pan/crosshair/reset, source disclosure, keyboard presets and fullscreen/Escape were exercised. No runtime errors on the verified production page. Screenshots were reviewed in the task conversation; measurements are retained in `artifacts/runs/klinecharts-20260911/result.json`.

The reusable UI smoke gains `chart-controls-browser.ts` and both-edge assertions, but this task did not execute the full standalone smoke or inject a browser feed outage. Stream tests cover retry, cleanup and background pause. No funded gameplay, hosted devnet, ten-round, physical-device or Safari/Firefox validation was performed. The port-3400 sandbox/genesis was preserved. No transaction, deployment, faucet, pool, Git initialization or publication occurred.

Sources: [KLineCharts](https://klinecharts.com/en-US/), [data integration](https://klinecharts.com/en-US/guide/data-integration), [styles](https://klinecharts.com/en-US/guide/styles), and installed 10.0.3 declarations/source.
