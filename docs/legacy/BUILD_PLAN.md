# FLINCH implementation plan

Historical token-exit design, superseded on 2026-09-05. See the current documents in docs/. Retained to explain the unmigrated Anchor program; not the current build specification.

## Delivery strategy

Build one vertical slice from deposit to withdrawal before polishing breadth. The project is not ready for interface work until the dependency and eSPL custody spike succeeds, and it is not ready for demo polish until conservation and recovery are proven.

## Proposed repository shape

```text
flinch/
  app/
    src/
      app/
      components/
      features/
        lobby/
        match/
        settlement/
      lib/
        chain/
        protocol/
        formatting/
  programs/
    flinch/
      src/
  packages/
    protocol/
    test-kit/
  tests/
    local/
    devnet/
    fixtures/
  scripts/
  artifacts/
  docs/
```

Choose the exact framework-generated directories during scaffolding. Keep shared constants and generated IDL types in one package so the app, tests, and bot runner cannot drift.

## Phase 0: compatibility spike

Goal: prove one coherent toolchain before feature code.

Tasks:

1. Create a temporary minimal Anchor workspace.
2. Test Rust ER SDK `0.17.0` with Anchor `1.0.2`, `anchor` and `vrf` features.
3. Test Session Keys `3.1.1` and the current scoped VRF macros.
4. Test the pinned `ephemeral-spl-api` git dependency.
5. Test TypeScript ER SDK `0.17.0`, GUM `3.0.10`, Anchor `0.32.1`, web3.js `1.98.4`, and SPL Token `0.4.15` together.
6. Execute a minimal pool-PDA deposit, player deposit, ER transfer, undelegate, and withdrawal.
7. Record versions, commands, incompatibilities, and selected builder paths.
8. Delete the throwaway spike or move only verified minimal pieces into the scaffold.

Exit criteria:

- program compiles;
- IDL client can build a transaction;
- eSPL uses exported API types/builders without copied bytes;
- one token unit cycle is observed across base and ER;
- dependency choices are pinned.

Status on 2026-09-05:

- complete: Anchor, ER, scoped VRF, Session Keys, and pinned eSPL API compile natively;
- complete: a deployable SBF artifact and Anchor IDL are generated;
- complete: eSPL CPI construction uses official typed API exports without copied discriminators or guessed PDA seeds;
- incomplete: the local base-to-ER-to-base token lifecycle has not run;
- incomplete: runtime compatibility of the pinned eSPL program and hosted services has not been proven.

## Phase 1: scaffold and protocol model

Tasks:

1. Initialize Git only after the user requests implementation.
2. Scaffold Anchor program, web app, shared protocol package, and test harness.
3. Add toolchain and environment example files without credentials.
4. Encode canonical constants and Round state.
5. Implement pure penalty, timeout distribution, cohort, and shuffle helpers.
6. Add deterministic and property tests before instructions.
7. Generate IDL and typed client boundaries.

Exit criteria:

- complete state fits within the calculated account allocation;
- pure game rules pass all reference vectors;
- no runtime code uses floating point for token amounts;
- formatting, type checking, and program build pass.

Status on 2026-09-05: core program scaffold, bounded state, deterministic engine, exact economics, typed integration boundaries, SBF build, IDL generation, formatting, tests, and strict linting are complete. Instruction-level runtime tests remain open.

## Phase 2: base setup and eSPL custody

Tasks:

1. Implement `initialize_round` and Round token-account creation.
2. Integrate pool eSPL bootstrap through `ephemeral-spl-api`.
3. Implement `delegate_round` with the selected validator.
4. Build player WSOL wrap and `delegateSpl` flow.
5. Add router discovery and placement verifier.
6. Implement ER `join` with an atomic stake transfer and seat write.
7. Implement pre-start cancellation and refund.

Exit criteria:

- four exact stakes enter one pool;
- every writable account resolves to one FQDN;
- wrong mint, amount, owner, or validator fails;
- cancellation returns the exact funded total;
- base and ER balance snapshots reconcile.

## Phase 3: live game engine

Tasks:

1. Implement `start_round` and Clock-based timestamps.
2. Implement wallet-authenticated `queue_sell`.
3. Integrate `SessionTokenV2` and session-only SELL path.
4. Implement cohort opening, closing, and single-seller resolution.
5. Implement seller payout transfer and replay-safe claim marker.
6. Add permissionless liveness calls.

Exit criteria:

- no wallet prompt is needed after session authorization;
- two-second cohort boundaries are deterministic;
- duplicated or reordered calls cannot double-sell or double-pay;
- running conservation holds after each instruction.

## Phase 4: VRF and terminal resolution

Tasks:

1. Add scoped VRF request with `#[vrf]`.
2. Add authenticated callback with `#[vrf_callback]`.
3. Implement unbiased bounded shuffle for up to four seats.
4. Bind and consume request nonce, cohort, bitmap, and rank range.
5. Implement ten-second timeout and deterministic remainder allocation.
6. Implement timer-expiry terminal selection.
7. Implement final-holder transfer of the exact pool remainder.

Exit criteria:

- one-, two-, three-, and four-intent cohorts resolve;
- forged, duplicate, late, and wrong-nonce callbacks fail;
- timeout always reaches a terminal, conserving state;
- pool reaches zero exactly once.

## Phase 5: oracle and replay evidence

Tasks:

1. Lock the devnet SOL/USD account, provider, feed ID, exponent, and freshness limit.
2. Add typed price validation.
3. Capture opening, sell, and closing samples when valid.
4. Make unavailable/stale samples non-blocking for economic instructions.
5. Emit compact protocol events.
6. Build a local indexer/cache that reconstructs the replay from events and Round data.

Exit criteria:

- all invalid-feed fixtures are rejected;
- stale service never traps settlement;
- replay identifies verified versus presentation-only samples;
- results reconstruct after browser refresh.

## Phase 6: terminal commit and withdrawal

Tasks:

1. Implement terminal Round commit/undelegation with `MagicIntentBundleBuilder`.
2. Integrate the selected eSPL undelegation and withdrawal builder.
3. Confirm extracted base signatures independently.
4. Verify ownership transitions and destination ATA deltas.
5. Add optional user-controlled WSOL unwrap.
6. Implement recovery UI for delayed commit and failed withdrawal.

Exit criteria:

- all four entitlements return to base correctly;
- each user can withdraw without operator custody;
- retries do not duplicate value;
- UI labels each finality stage accurately.

## Phase 7: product interface

Tasks:

1. Build the landing explanation and create-room flow.
2. Build four-seat lobby with preparation pipeline.
3. Build the chart-first room and player markers.
4. Build exact SELL preview and confirmation.
5. Build tie-pending and reveal presentation.
6. Build payout result, proof drawer, withdrawal, and replay.
7. Add responsive, keyboard, reduced-motion, and reconnect behavior.

Exit criteria:

- first-time rule comprehension test succeeds;
- critical states are visible without opening developer tools;
- mobile and desktop views remain legible;
- frontend production build and critical interaction tests pass.

## Phase 8: demo automation and hardening

Tasks:

1. Add three ordinary funded bot players.
2. Add a deterministic demo conductor that submits real transactions at scripted moments.
3. Produce the machine-readable evidence bundle.
4. Run all negative and recovery scenarios.
5. Run ten sequential devnet rounds.
6. Measure SELL acknowledgement and end-to-withdrawable latency.
7. Add service-health diagnostics and operator runbook.
8. Scan secrets, repository residue, oversized assets, and generated files.

Exit criteria:

- the three-minute judge script succeeds twice from a clean browser;
- soak test has no manual repair;
- proof links and balances are complete;
- submission copy makes no unverified claims.

## Recommended build order by vertical slice

1. One wallet, one Round, one token deposit, one ER transfer, one withdrawal.
2. Four wallets, no sessions, sequential sells, exact settlement.
3. Session-authorized SELL.
4. One live VRF tie and timeout fallback.
5. Oracle snapshots and replay.
6. Finished UI and bots.

This sequence puts the hardest custody and routing assumptions first.

## Ownership

For a small team:

| Lane | Primary work | Merge gate |
| --- | --- | --- |
| protocol | program, arithmetic, VRF, events | invariant and authorization tests |
| integration | eSPL, router, sessions, oracle, E2E | full signatures and balance evidence |
| product | room UI, reconnect, finality states | Playwright and visual review |
| demo | bots, conductor, evidence, submission | two clean rehearsals |

One person must own the complete deposit-to-withdraw path even if the code is divided by lane.

## Cut order if schedule slips

Cut in this order:

1. public room discovery;
2. animated replay embellishments;
3. optional WSOL unwrap;
4. multiple stake presets;
5. rich historical match list.

Do not cut:

- real eSPL custody;
- session-authorized SELL;
- live VRF tie resolution;
- conservation tests;
- base commitment and withdrawal proof;
- clear settlement-state UI.

## Final definition of done

FLINCH is done for V8 when a fresh reviewer can clone the future repository, follow documented setup, create a devnet room, complete a four-player match with a real VRF tie, verify all payouts sum to the pool, return balances to Solana, and inspect retained proof without asking the original team how the architecture works.
