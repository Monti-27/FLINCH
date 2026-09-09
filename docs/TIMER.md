# Round timer

## Shared countdown clock, 2026-09-11

The live timer report reproduced as `67 → 64`: a fresh integer-second base Clock reading replaced the previous extrapolated value immediately. The ring then followed a separate 250ms tween, leaving its circumference behind the number. This section supersedes the observation-driven sweep and large-correction behavior below; the size, centered digits, colors and extending/retracting bars are unchanged.

`room-observation.ts` now records a separate monotonic receipt timestamp immediately after the base read, before resolving the ER. It preserves that timestamp on base failures. Wall-clock timestamps, freshness checks, SELL authorization, quotes and transaction clocks are unchanged. The concurrent network-timeout recovery change in that file is separate from this timer fix.

`countdown-clock.ts` seeds the presentation from the observed chain time minus elapsed monotonic time, including time spent waiting for ER resolution. Each fresh advancing sample adjusts a target deadline, not the displayed value. The shared estimate approaches corrections at at most 10% above or below real elapsed time. Repeated, backwards and out-of-order samples cannot move the deadline backwards or add displayed seconds. Missing observations do not restart or freeze the estimate. After a frame gap of at least five seconds, elapsed time is consumed immediately; missed seconds are not replayed. A fresh chain reading at or beyond expiry immediately clears the timer. Zero stays zero for the same round, and never implies settlement.

`use-countdown.ts` advances one Framer Motion value using `performance.now()`. The dial fill/color and rounded-up seconds derive from that value; there is no separate progress tween. React updates the digits only when their whole second changes. Hidden documents skip frame work and catch up on visibility return. Funding remains full, confirmed terminal state/cancellation shows END, room changes reset the clock, and reduced motion removes the decorative springs without changing elapsed time. A stale estimate remains labelled and muted.

Verification: the 35 focused clock/observation/overview tests pass, including the original jump, every second under jitter, duplicate/backwards reads, delayed delivery, suspension, zero latching and confirmed expiry. The full frontend suite has 474 passing tests, including concurrent network-recovery coverage; both TypeScript checks, production build, 381-module no-comment/size scan and 738-file selected secret/artifact scan pass. The optional bigint native binding warning still falls back to the existing pure-JavaScript implementation.

Browser evidence: `artifacts/runs/timer-1789090641680/result.json`. The live irregular-sample sequence is `67, 66, 65, 64, 63, 62, 61, 60, 59`, sampled across 481 frames with zero layout shift and a maximum ring/number boundary difference of 17.18ms. It also checks 90 through zero, colors, bar motion, 320/375/768/1280px geometry, live reduced motion, system-clock changes, a controlled 20-second frame gap, stale recovery, confirmed expiry and room replacement. These are local real-component tests with synthetic timing inputs, not a new funded Devnet round. The initial browser rerun failed because the test tried an unsupported clock-uninstall API; the corrected test uses a fresh page.

Final slowed-CPU run `timer-1789090803172` also passes with 4x CPU throttling, the same complete sequence, zero layout shift and a 17.26ms maximum boundary difference. It additionally verifies a simulated hidden-document stop and catch-up on visibility return. Production arena smoke `ui-smoke-1789090749822` passes responsive layout, keyboard, wallet picker, stake entry, chart controls, reduced motion, reload and outage recovery with no page errors. The temporary read-only port-3511 preview was stopped after validation.

This patch is local only. No deployment, signing, custody cycle, live Devnet soak, faucet request, pool or financial-rule change was performed. Existing hosted gameplay and historical Devnet evidence are not claims that this timer revision has shipped.

## Centred dial refinement, 2026-09-11

The follow-up request moves the rolling seconds into the ring, enlarges the SVG from 88px to 160px on desktop (116–140px on compact widths), and removes the timer's left border and padding. The ring and number share one grid cell; the digits fit inside the inner radius without changing position as they roll.

The original implementation did not reproduce the reference's individual bar extension/retraction. A second study extracted 144 close-spaced crops across the idle, growing and shrinking portions of the supplied video, retained in `artifacts/runs/timer-motion-reference-20260911`. Active bars are visibly longer than inactive bars, and the changing edge has individual length movement. The replacement gives every bar its own damped spring, with a fixed inner anchor, 11-unit resting length, 14-unit active length and a bounded signed edge ripple. Coloured and grey strokes share their moving endpoint, so deactivated bars visibly contract as well as losing colour. Neighbouring bars can extend and retract simultaneously. Reduced motion, funding, stale state and terminal state jump directly to their current geometry; there is no independent idle-animation loop.

This is a reconstruction of visible motion from video frames, not the original source or a proven frame-exact copy. The reference is an interactive humidity dial with irregular increases and decreases; FLINCH preserves its actual countdown and the previously requested complete circle. No timing, custody or financial authority changed in this follow-up.

Updated proof: 16 focused timer tests pass. `timer-1789072832507` passes centred geometry/no divider at 320/375/768/1280px, each second from 90 to zero, colors, reduced motion and real bar/digit interpolation. The earlier successful motion sample `timer-1789072667646` recorded 139 frames with bars moving in opposing directions and 140 distinct shapes, with no outer-layout shift. `timer-arena-1789072986424` passes the actual port-3400 arena at 320–1920px, adjacent controls, keyboard focus, reload and reduced motion, with no page errors.

The 376-web-test snapshot passed before concurrent landing edits. Later full type checks and the shared production build are blocked by unrelated bento source/test contract changes; root type checking and source/selected artifact scans pass. A separate application snapshot build also hit an upstream Webpack WasmHash error, so it is not production-build proof. The timer fixture now ignores `.next` build-output changes and pauses its controlled clock before stepping; the earlier run caught build-triggered reloads and real-time drift between accelerated clock steps. No unrelated code was changed to suppress those failures.

Use the existing game at `http://127.0.0.1:3400/play` for this revision; it passed the actual arena checks. The old port-3500 production preview was stopped. An isolated preview attempt in `/tmp/flinch-timer-preview-0ymfT8` could not resolve the workspace's hoisted TypeScript packages and was stopped as well; its automatic dependency installation failed before resolving the local workspace package. No application dependency was changed by this task. Do not reuse port 3500 as a working preview. The user's sandbox on 3400 and its genesis remain untouched. No fresh onchain or devnet validation was performed.

## Reference and scope

The sections below document the first timer revision; the centred dial refinement above supersedes its layout and bar-motion description.

The 2026-09-11 timer replaces the eighteen rectangular segments and `01:30` label in the game header. The user supplied `EtJ8jme-ZQ8aoDWP-optimized.mp4` and the existing timer screenshot. Sixteen exact frames from the 10.784-second video are retained in `artifacts/runs/timer-reference-20260911`, including a contact sheet and the original timer source backup.

The reference has fine rounded radial bars, a slight crest at the active edge, and blue, green and amber value ranges. The implementation uses those features on the existing charcoal surface. The user explicitly requested a full circle at 90 seconds, so the dial closes the reference's bottom gap. Seconds sit beside the dial instead of inside it. No humidity labels, slider, white card, percentage, or reference background is copied. The dial-only color tokens are deliberate reference colors, not changes to the shared palette.

## Ownership and timing

- `timer-state.ts` bounds milliseconds before conversion and derives presentation time from the observed base Clock plus elapsed wall time. No balances, quotes, admission rules or transaction clocks change.
- `RoundTimer` owns labels, accessible timer semantics and fixed-width Framer Motion digits. `TimerDial` owns 72 fine SVG bars. Component CSS owns responsive geometry and the three scoped colors.
- At 90 seconds every bar is blue. As time decreases, the circumference drains through fractional bars, changes to green through the middle, then amber near empty. The moving edge has a bounded four-unit crest.
- Each changed digit enters from below and exits above with one interruptible spring. Initial rendering does not roll from zero. Unchanged digits remain still. The surrounding timer and action layout do not animate.
- The dial interpolates the existing 250ms observation-driven updates at a constant rate. This is intentionally linear for elapsed time; digit transitions use spring physics. Large clock corrections snap to the current estimate instead of replaying elapsed seconds.
- Funding stays fully lit at 90. Stale estimates are explicitly labelled and muted without animated updates. Reduced motion remains a live provider preference and removes transitions while preserving the current data.
- Zero empties the dial but never means settlement. Only confirmed terminal state or cancellation displays `END`. A new room remounts the timer.

The frontend-design and page-load-animation skills guided fixed geometry, motion interruption, scoped styling and reduced-motion behavior. The storyboard is documented here instead of source comments, following the repository's no-comments rule.

## Verification

`bun run --cwd apps/web test tests/standoff.test.tsx tests/timer-state.test.ts` runs 15 timer and overview tests. They cover exact clamping, chain observation time, full/empty/partial circumference, every 125ms slice, color ranges, crest bounds, funding, stale estimates, cancellation and zero-versus-settlement semantics.

`FLINCH_BROWSER_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node apps/web/tests/timer-browser.ts` serves the real component through the already-installed Vite test dependency. Its fixture is isolated from the app routes, wallets and networks. `timer-1789071116054` passed all 90 countdown steps using controlled browser time, real-time digit/ray interpolation, fixed geometry, color changes, all terminal states, live reduced motion and 320/375/768/1280px layout. The real-time sample observed 50 moving digit frames and 141 distinct radial fills with zero outer-layout shift.

`FLINCH_UI_URL=http://127.0.0.1:3500/play FLINCH_BROWSER_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node apps/web/tests/timer-arena-browser.ts` checks the production arena timer, responsive overlap, adjacent rules keyboard/focus behavior, stake selection, reload and live reduced motion. It does not replace the broader UI suite.

Final production arena evidence: `artifacts/runs/timer-arena-1789071537639/result.json`, with screenshots at 320/375/768/1280/1920px and no page errors. Earlier timer fixture runs exposed an immediate-versus-next-frame SVG assertion and a test that did not open the compact player disclosure before selecting its rules link; the assertions now follow the actual component lifecycle and interaction path. No unrelated UI behavior was changed to make these tests pass.

The workspace snapshot passed 317 web tests, both TypeScript checks, the production build, and source/selected-secret/artifact checks. Concurrent number-animation work briefly failed the web type check before the later successful checks; this task did not edit those files or dependencies. The broader production `ui-smoke-1789071254273` failed at the chart fullscreen Escape/focus assertion; its retained failure is not a timer pass and the chart was not changed here.

The original local sandbox on port 3400 was preserved. This is a UI-only validation: no fresh custody/ER/swap/claim cycle, public devnet routing/session/oracle/swap/withdrawal proof, or ten-round devnet run was performed. Existing protocol and release gates remain open. No deployment, pool creation, faucet request, Git initialization or publication occurred.

The tested read-only production preview is `http://127.0.0.1:3500/play`, exec session 71772. Verify before reuse. Other tasks were concurrently changing the footer, chart and shared numeric presentation; this task does not claim ownership or validation of subsequent changes to those surfaces.
