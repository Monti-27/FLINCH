# Arena control panel

## Reference-led direction, 2026-09-11

The user approved the entry-panel redesign, then requested the same treatment after creating and joining a room and on the withdrawal screen. The two supplied videos were decoded and inspected frame by frame. The useful patterns were the softly inset currency rows, restrained token pills, right-aligned amounts, centered actions and anchored disclosure motion. No third-party implementation was copied or new dependency installed.

Design-taste, frontend-design-guidelines and page-load-animations guided the hierarchy, progressive disclosure, responsive geometry and reduced-motion behavior. Existing product fonts, charcoal surfaces and pale-blue actions remain. The stake editor has one Max preset, native exact editing and the existing bounds. Entry-mode changes use a short keyed reveal; the sell-penalty disclosure uses a measured spring. Room controls no longer stretch to the neighboring chart's height.

## State and interaction contract

- Before joining, show the exact equal stake, available seats, session toggle and explicit session permissions/costs. Full or expired rooms do not offer a join action or session setup.
- After joining, derive the seat and deposited stake from the confirmed room ledger. Show “You’re in” with the remaining player count, not the old join heading and maintenance-only layout.
- Cancellation and revocation remain available through a compact native room/session disclosure. Non-funding views do not repeat a nested room-controls heading. Session storage, bound-signer state and revocation lag remain distinct from verified permission availability.
- Funding, SELL and withdrawals share `AssetTicket` geometry. Long exact amounts can use a stacked row instead of clipping or rounding. Quote ranges and claims remain exact, static transaction values; only the existing confirmed-holding counter animates.
- The SELL ticket retains signed minimum, freshness, refresh, fee details, wallet timing and queued-is-not-sold semantics. Primary actions are centered, without decorative diagonal arrows.
- Claims remain derived from confirmed base state. Pending approval and uncertain transactions keep amounts visible. Rejection does not remove balances. Recovery is independently gated and no claim is marked complete optimistically. WSOL stays wrapped.
- `TicketDisclosure` retains native summary semantics, keyboard activation and focus. Supporting browsers animate intrinsic height over 300ms with reversal; others retain functional native disclosure. Live reduced motion disables nonessential transitions.
- Initial room reads use the shared header, asset row, metadata and action footprint. They do not display an invented stake, seat or room phase. See `LOADING_STATES.md` for independent chart/feed boundaries.

The presentation changes preserve existing instruction builders, action handlers, bigint conversion, journal scopes, wallet checks and deployment gates. No program, routing or custody behavior is changed by this pass. The concurrent session-token program-id argument was preserved.

## Evidence

`apps/web/tests/room-tickets-browser.ts` mounts actual Funding, Claims and SellTicket components in an isolated browser fixture. Its room/quote values are explicitly test data, its signer cannot sign, and its mock approval never submits. It checks 13 states at 320, 375, 768 and 1280px, native keyboard controls, disclosure height frames and reversal, reduced motion, exact pending amounts, rejection and stale-quote gating.

Passing evidence:

- `artifacts/runs/room-tickets-1789076626506/result.json`: all 52 state/viewport combinations; associated joined, refund, completed, recovery, quote and full-precision screenshots were inspected.
- `artifacts/runs/control-panel-1789076683115/result.json`: production entry controls, responsive layout, player seats, terms reversal, draft persistence and reduced motion. The local 4x-CPU sample observed p95 16.7ms and maximum 16.8ms, not a universal performance guarantee.
- `artifacts/runs/stake-browser-1789076684366/result.json`: exact input, rapid adjustments, slider, touch, keyboard, rolling directions and interrupted motion.
- `artifacts/runs/skeleton-1789076685662/result.json`: production chart-code/history delays, shimmer, failure/retry and pending-room navigation, before the final room-only placeholder refinement.
- `artifacts/runs/skeleton-1789076915991/result.json`: repeated production loading checks after the final room-card placeholder refinement; all assertions pass.
- `artifacts/runs/initial-loading-1789076686942/result.json`: server-only first paint without the old loading panel.

The production build, both TypeScript checks, all 435 web tests and selected source/secret/generated-artifact checks passed. Concurrent work added tests during this pass; 408 was the earlier successful count. The final source scan checked 339 handwritten TypeScript modules and the selected secret/artifact scan checked 683 files before these documentation additions. The room-state browser fixture replaces Next's image wrapper with the existing test image adapter; the full-page production tests exercise actual Next output. The preview snapshot is `/tmp/flinch-room-preview.HfVa3l` on port 3531. The original funded port-3400 sandbox remains running and was not reset.

Backups before these changes are `artifacts/runs/control-before-YNpY1n/source.tar` and `artifacts/runs/room-tickets-before-q4vWuP/source.tar`. They are evidence, not safe replacements for the current tree: unrelated landing, footer and financial-client work changed concurrently.

This is frontend verification, not a new protocol release check. No transaction, custody/ER/swap/claim cycle, public devnet integration, ten-round soak, deployment, faucet, pool creation or publication occurred. Safari/Firefox, physical-device performance and final visual acceptance remain unverified. Earlier failed fixture runs retain setup errors and the corrected full-precision overflow for auditability.
