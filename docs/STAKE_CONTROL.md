# Stake control

## Direction, 2026-09-11

The user supplied `skiper22.mp4` and a screenshot of the existing lobby, requesting better alignment, token entry, increase/decrease controls and rolling numbers. The recording was decoded into 464 frames over 9.15 seconds. Contact sheets covering the whole recording are retained in `artifacts/runs/stake-control-5gNCIA`. No protected Skiper implementation was copied.

Design-taste and frontend-design-guidelines informed a compact charcoal instrument with the existing Solana artwork, fonts and palette. The centered amount is the dominant element. A quiet token header, stable circular adjustments, native range control and moving preset background replace the previous plain field. Mode changes have a short reveal and sliding selection. The fee summary is compact; the primary action follows the form rather than the height of the neighboring chart.

This is a narrow exception to earlier instructions against animating editable amounts: the stake draft rolls after explicit adjustments, but native text editing stays static. This task does not change quotes, claims, balances, transaction signing, custody, settlement or the allowed stake range. Concurrent chart, timer, shared-number, landing and footer work is not reverted.

## Ownership

- `features/lobby/stake-control.tsx` owns presentation and native input events.
- `stake-control.module.css` owns the amount, slider, preset and press treatments.
- `stake-value.ts` owns bounds, exact step arithmetic and the slider mapping.
- The provider-scoped UI store remains the only stake draft. Its setter accepts functional updates so several rapid clicks cannot collapse into one adjustment.
- `create-room.tsx` uses the same exact validation bounds before its existing network checks and operation runner.
- Shared `AnimatedNumberCounter` renders the decorative digits without green/red flashes or directional arrows. No new dependency was installed by this task.

## Input and motion contract

The program range remains 0.001–0.01 SOL. Plus/minus changes by 0.001 SOL; Shift changes by 0.0001. Manual entry preserves up to nine decimal places. The slider has 91 positions at exact 0.0001-SOL intervals. Its position is presentation only: viewing a precise manual value does not round the draft. Max selects the protocol maximum, not the wallet balance.

All amount conversion and adjustment uses bigint and the shared client parser/formatter. Only the bounded slider index and CSS progress use JavaScript numbers. Invalid or partial drafts survive blur and mode changes. Explicit adjustments recover a malformed draft to the minimum; submission still rejects invalid values.

The amount retains a fixed-height hit area. Its native labeled text input remains the accessible and submitted value; the rolling representation is decorative. Focus exposes native text and caret, and unmounts the decorative counter. Blur restores the exact current value without replaying a hidden typing animation. Presets, steps and range changes update immediately and never submit. Pending operations disable all stake controls.

The shared counter rolls for 250ms; selection moves for 250ms; hover/press feedback uses 100ms; mode content uses 150ms. Live reduced motion disables all nonessential motion. There are no automatic changes, idle number loops, timers that delay input, hidden rounding or interpolated transaction amounts.

## Verification and limits

`apps/web/tests/stake-control.test.tsx` covers exact bounds, malformed input, repeated adjustments, fine steps, every slider position, functional-store updates, SSR labels, disabled controls and decorative numeric output. The focused stake/control/store/number suite has 78 passing tests, including 31 stake checks.

`apps/web/tests/stake-control-browser.ts` runs against loopback only and blocks transaction submission. It covers both actual rolling directions, reverse interruption, rapid clicks, exact editing, keyboard controls, drag, touch, live reduced motion, draft persistence and responsive hit targets. Above-fold checks use document coordinates, not a screenshot-induced scroll position.

Final evidence: `artifacts/runs/stake-browser-1789073911466/result.json`. All cases pass at 320, 375, 768, 1024, 1280 and 1920px with no submitted transactions or page errors. Create's document-relative bottom is at most 879px in a 900px-high viewport. The final standard and full-precision screenshots were reviewed.

`artifacts/runs/stake-control-5gNCIA/layout-result.json` additionally passes the existing component, layout, ecosystem-asset and chart-control helpers against the final production snapshot. Both desktop panel edges align and compact layouts put actions first. The local 4x-CPU probe observed 90 frame intervals, p95 18.1ms and maximum 19.3ms; this is not a device or browser-wide performance guarantee. The final focused suite and both working-tree TypeScript checks pass, with 299 source modules and 633 selected files scanned before these documentation updates.

The final production preview is built from `artifacts/runs/stake-production-3xDjgL`, with the final lobby files copied from the working source. The frozen full-web suite has 372 passing tests and its production build/type check passes. Current working-tree checks must be distinguished from this snapshot: landing bento implementation and tests changed concurrently and produced intermittent unrelated failures. Full-page smoke also stopped at the footer's no-JavaScript arena expectation; it is not a passing whole-site run.

Final working-tree full-suite result: 384 of 385 tests pass; the sole failure is the concurrent landing test still requiring the removed landscape attribution. All six lobby/style modules and the atomic stake setter match the tested production copy. The shared UI store separately renamed footer pause fields to ambient pause fields in another task; those unrelated changes are preserved, not replaced with the snapshot.

Early interaction checks exposed coalesced rapid-click updates and a hidden number-width transition after text editing; both were corrected. Screenshot-scrolling and NumberFlow's mask padding required more precise geometry assertions. A full-page check exposed the taller first version placing Create below the fold; fixed amount height, tighter spacing and an action anchored to form content address this.

This is frontend-only validation. No new onchain round, local custody/ER/swap/claim cycle, public devnet transaction, hosted-service check, ten-round soak or ordinary-wallet signing proof is claimed. No deployment, faucet request, liquidity pool, Git initialization or publication occurred. The funded port-3400 sandbox was not stopped or reset. Source size/comment and selected secret/artifact checks pass; these are not a comprehensive security audit. Physical devices, Safari/Firefox and visual acceptance remain unverified.
