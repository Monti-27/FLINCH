# Gameplay completion plan

## Requested outcome

Make the existing four-player WSOL game work end to end, with reliable recovery, clear UI states and smooth transitions. The user additionally requested substantially better component design using detailed live study of Collect UI and useful high-quality libraries such as Skiper UI. Redesign the actual controls and gameplay components, not only their arrangement. Keep the existing footer and official brand assets. Do not substitute a simulated trading product or claim public availability from local tests.

## Work order

1. Re-establish current protocol and browser baselines. Inspect every failure and retain signatures, logs and balances.
2. Fix quote preparation and room observation: remove duplicate route discovery without removing before-sign/after-sign validation; avoid prompting for expired quotes; retain last confirmed balances through transient reads; use ER time for SELL admission and base time for settlement/recovery.
3. Test unhappy paths: quote expiry, wallet rejection, reload at handoffs, loss of ER, unknown submissions, duplicate actions and keeper restarts. Preserve exact minima, session limits, base-only claims and replay protection.
4. Make funding, live position, pending intent, returned control, confirmed exit, withdrawal and recovery understandable in the UI. Add non-blocking, reduced-motion-aware transitions without tweening balances or replaying entrances on polling.
5. Provide a usable local operating workflow with ordinary wallets and a permissionless keeper, not only a one-shot test. Check configuration, shutdown and source/secret boundaries.
6. Complete public devnet setup only after the user's separate deployment, funding and pool authorization. Verify hosted routing, session revocation, oracle context, swaps, recovery, withdrawals and at least ten sequential rounds with retained evidence.

## Completion evidence

- Full Rust/domain/runtime/client/keeper/frontend gates, production build and selected source/artifact scans.
- Actual base custody → delegated control → session intent → undelegation → Raydium swap → wallet claim, plus expiry/recovery paths. No injected Control in cross-runtime tests.
- Browser gameplay and fault scenarios on mobile/tablet/desktop, keyboard/focus, reduced motion and no repeated wallet signature or unknown-state retries.
- Measured request counts and elapsed phase timings, with no latency guarantee inferred from local hardware.
- Public devnet evidence and ten sequential rounds; a local test or status-page response cannot satisfy these requirements.

## Baseline, 2026-09-08

`scripts/verify-v2.sh` passed in the current workspace before implementation, including 35 domain cases in debug/release, 23 runtime tests and 146 web tests. Runtime evidence is under `artifacts/runs/core-baseline-20260908`. Browser run `artifacts/runs/mb-stack-BlAlj8/result.json` completes two local swaps, four claims, reload and session revocation. It uses synthetic local liquidity and a test Wallet Standard adapter.

The first implementation targets verified structural gaps: three route-resolution passes on browser SELL, quote expiry not checked immediately before the signing prompt, removal of the last room snapshot after a transient base read error, and UI quote eligibility that does not fully reflect the ER cohort. These findings do not explain the historical intermittent domain rejection.

Previous source is retained in `artifacts/runs/core-before-tI5HUV/source.tar`. Public deployment and funding remain unauthorized. The objective stays incomplete until the full evidence above exists.

## Implementation progress, 2026-09-09

Quote validation now runs immediately before the wallet signer as well as after signing and before submission. Browser SELL uses two verified placement reads instead of three. A focused pipeline test proves zero work before the operation guard, one signing call, correct pre-send journaling, no broadcast after changed placement and safe recovery from rejected approval.

Room reads retain confirmed balances and timestamps through transient failures, clearing Control until a valid ER observation returns. Base and ER clocks are tracked independently. SELL eligibility and displayed quote freshness use the client's cohort, nonce, attempts and entitlement checks. These changes preserve exact minima and never treat accepted intent as a swap.

The token-ticket presentation and selectors follow the additional live Collect UI/Skiper study in UI_DESIGN. The footer, shader, palette tokens and approved geometry compare byte-identical across ten protected files against the pre-task backup.

Iteration evidence: `mb-stack-AJE6rI` reached live play and correctly disabled SELL on an injected ER read failure; its assertion expected the raw RPC error, while the validated client intentionally returns a generic error. The test now checks that actual error and proves the request was intercepted. `mb-stack-64IMrn` and `mb-stack-yJjVGw` caught an above-fold regression from the taller ticket; `mb-stack-JZyT6S` then passed desktop but caught an intrinsic-width chart overflow at 768px. These are retained failures, not complete rounds. Subsequent passing evidence belongs in TESTING; none of these failures establishes public devnet behavior.

## Standalone operation progress, 2026-09-09

The next slice adds an interactive local sandbox (`tools/local`) and room sharing. See LOCAL_PLAY for explicit startup, bounded synthetic grants, manual room watch, keeper pause/resume, service-exit monitoring, cleanup and world-reset limits. Four independent browser adapters have completed four deposits, three sales and four claims. Ordinary extension support and durable sandbox resume remain incomplete; this improves milestone 5 without declaring it complete.

The permissionless keeper now runs independently with explicit execution, room/network validation, owner-only payer loading, durable journals and single-process ownership. Separate-process tests prove a pending-execute restart without another trade, two actual swaps, four claims and a rejected duplicate process. A session-intent scenario with an injected ER HTTP outage reaches the real onchain cutoff and completes base recovery and four unchanged-WSOL claims. See KEEPER_OPERATIONS and TESTING for exact commands, evidence and crash-lock limits.

The browser scenario now uses this continuously running service instead of manually advancing the worker. The complete local browser cycle and production UI suite pass. No financial rule, UI presentation, footer or official asset changed during the keeper continuation. This is progress on the operating-workflow milestone, not its completion: a convenient persistent local environment, actual ordinary extension wallets, further fault/soak testing and separately authorized public devnet remain outstanding.

## Cross-runtime fault progress, 2026-09-09

Two independent keeper processes now race two real base settlements with distinct keys and journals; exactly one swap succeeds per receipt, losers make no token changes, both workers reconcile and all four players claim. A separate scenario revokes a warm session on base, observes rejection on the selected ER, verifies unchanged Control/custody, then completes two swaps and four claims through wallet fallback. Run `test:stack:competing` and `test:stack:session` sequentially. TESTING retains exact evidence and failed test iterations. These extend milestone 3's unhappy-path proof; stale/late commitments, other timing races, public devnet and full operational completion remain open. No UI or protocol change was needed for these passing cases.

The subsequent `test:stack:delayed` and `test:stack:delayed:recovery` now block actual targeted committer writes after ER freeze acceptance. With unmodified chain time and Control, they prove late base return, expired-fill rejection, paired fill/expiry submissions, base recovery while still delegated, prior USDC claims during the transport fault and preserved holder WSOL after a late return. Final runs complete all four claims. They do not cover every old-generation replay or race schedule. The normal critical browser and production UI regressions also pass; see the newest TESTING section. Changes remain in the test harness and documentation, not game rules or presentation.
