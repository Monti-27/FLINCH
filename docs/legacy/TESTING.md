# FLINCH testing strategy

Historical token-exit design, superseded on 2026-09-05. See the current documents in docs/. Retained to explain the unmigrated Anchor program; not the current build specification.

## Testing principle

Every claim is matched to the lowest environment that can prove it. A passing unit suite cannot prove router placement, live VRF delivery, or base withdrawal. A devnet signature cannot replace deterministic invariant tests.

## Validation ladder

| Claim | Environment | Gate | Evidence | Does not prove |
| --- | --- | --- | --- | --- |
| penalty math and conservation | Rust unit/property tests | every state vector passes | test output and fixed seeds | runtime routing |
| instruction authorization | program-test or compatible in-process harness | all positive and negative cases pass | logs and test report | live services |
| eSPL CPI/builders compile together | compatibility spike | pinned workspace builds | lockfiles and build output | deployed lifecycle |
| delegation and ER token movement | `mb-stack` or official example harness | one full local cycle | base/ER signatures and balances | hosted router/oracle reliability |
| scoped VRF integration | environment with VRF service | request and authenticated callback pass | request/callback signatures | mainnet behavior |
| router placement and propagation | devnet | ownership/FQDN assertions pass | captured account snapshots | long-term availability |
| live oracle validation | devnet | correct feed accepted; bad/stale fixtures rejected | account data and test logs | price accuracy beyond provider trust |
| terminal settlement and withdrawal | devnet | exact wallet ATA deltas | all signatures and before/after balances | production custody readiness |
| complete demo reliability | devnet | ten sequential rounds | machine-readable result bundle | mainnet load |

## Deterministic game tests

### Canonical payout

For stake `100_000_000`:

- rank one receives `80_000_000`;
- rank two receives `88_000_000`;
- rank three receives `94_000_000`;
- holder receives `138_000_000`;
- total is `400_000_000`;
- final pool balance is zero.

### Property tests

Generate stakes across the allowed range and all valid sell patterns. Assert:

- total payouts equal total funded units;
- every payout is at most the complete pool and nonnegative;
- seller penalty uses original stake, not current pool share;
- sell ranks are unique and contiguous;
- exactly one terminal holder exists;
- repeated resolution does not change balances;
- timeout penalty distribution preserves the normal total penalty;
- deterministic remainder allocation differs by at most one base unit;
- widened multiplication never truncates before division.

### State-machine tests

Cover every permitted transition and reject every skipped or reversed transition. Include:

- start before four deposits;
- join twice;
- duplicate wallet in two seats;
- SELL before start, after end, twice, or as last holder;
- new cohort while VRF is pending;
- early resolution;
- callback after timeout;
- settlement with pending payout;
- cancellation before and after start;
- repeated settlement and cancellation.

## Authorization tests

- wallet submits its own SELL;
- valid session submits for its wallet;
- wrong wallet, signer, target program, Round, or seat is rejected;
- expired and revoked sessions are rejected;
- reused action nonce is rejected;
- session cannot call start, resolve, undelegate, withdraw, or recovery;
- arbitrary caller can invoke only documented permissionless liveness paths;
- substituted token, eSPL, VRF, oracle, delegation, or System Program account is rejected.

## Cohort and VRF tests

- intents one second apart inside one cohort tie;
- intents across the boundary enter different cohorts;
- one-seller cohort skips VRF;
- two-, three-, and four-intent cohorts use deterministic fixed randomness fixtures;
- Fisher-Yates range mapping rejects biased samples correctly;
- request state is written before callback acceptance;
- wrong scoped identity is rejected;
- wrong nonce, bitmap, rank range, Round, and queue are rejected;
- duplicate callback has no effect;
- timeout before ten seconds is rejected;
- timeout after ten seconds conserves value;
- late callback after timeout is rejected;
- terminal multi-holder selection at round expiry completes or times out safely.

## Oracle tests

- canonical fresh SOL/USD feed succeeds;
- wrong account or feed ID fails validation;
- wrong exponent fails;
- `posted_slot = 0` fails even if verification level appears full;
- stale publish time is ignored for snapshots;
- zero and negative values are ignored;
- maximum integer conversion cannot overflow;
- unavailable oracle never blocks SELL resolution, payout, cancellation, or withdrawal;
- replay marks only program-validated samples as verified.

## Token tests

- wrong mint, owner, authority, or token program is rejected;
- exact stake moves from player ER token account to pool;
- underfunded player cannot take a seat;
- player seat write and transfer are atomic;
- each seller payout transfers once;
- holder receives exact remaining balance;
- pool reaches zero;
- cancellation returns exact funded stake;
- default and legacy withdrawal builders are not mixed accidentally;
- withdrawal before base ownership restoration fails safely;
- retry after confirmed undelegation succeeds without duplicate credit;
- WSOL ATA close unwraps only on explicit user action.

## Placement and routing tests

For Round and every eATA involved in a transaction, capture:

- base owner before delegation;
- base owner after delegation;
- router `isDelegated`, validator, and FQDN;
- ER owner and data availability;
- base owner and data after undelegation.

Negative cases:

- one account not delegated;
- one account delegated to another validator;
- ER transaction built with a base blockhash;
- delegated mutation sent to base;
- delegation sent to ER;
- stale cached FQDN after re-delegation.

## Local integration scenario

The local runner should perform:

1. start a pinned local MagicBlock stack with required cloned programs/accounts;
2. build and deploy FLINCH;
3. create WSOL-compatible test mint fixtures if native mint behavior is unavailable locally;
4. create Round and pool custody;
5. deposit and delegate four player balances to one validator;
6. verify router/ownership placement;
7. create sessions;
8. join and start;
9. resolve one ordinary sell and one tied cohort;
10. exercise VRF callback or a documented local service substitute;
11. settle and assert balances;
12. undelegate and confirm base commitments;
13. withdraw and assert destination balances;
14. stop all child services deterministically.

If the local stack does not include a working router, oracle, or VRF service, that stage must use a fixture and be labeled as local logic coverage. Devnet remains the live integration gate.

## Devnet end-to-end scenarios

At minimum run:

1. three sequential sellers, one holder, no tie;
2. two sellers in one cohort with VRF;
3. every active player attempts to sell in one cohort;
4. VRF timeout fallback;
5. stale oracle during a live round;
6. player reconnect with state reconstruction;
7. session expiry and direct wallet fallback;
8. pre-start cancellation and exact refund;
9. delayed undelegation followed by successful withdrawal;
10. ten-round soak with alternating scenarios.

## Evidence bundle

Each E2E run writes a JSON artifact outside source code containing:

```text
run_id
git_commit
network
program_id
dependency_versions
validator_identity
router_fqdn
round_pubkey
base_signatures[]
er_signatures[]
vrf_request_signature
vrf_callback_signature
commit_signatures[]
withdrawal_signatures[]
starting_balances{}
ending_balances{}
payouts[]
oracle_samples[]
invariant_results[]
started_at
completed_at
result
```

Never put secret keys or signed transaction payloads in this artifact.

## Frontend tests

- unit-test amount formatting, penalty preview, countdown, and lifecycle labels;
- test duplicate-click suppression and transaction retry state;
- test stale oracle while SELL remains enabled;
- test reconnect from each onchain Round status;
- test direct-wallet fallback after session failure;
- run the full one-human/three-bot journey in Playwright;
- run keyboard navigation and automated accessibility checks;
- verify mobile and desktop layouts at the intended demo resolutions.

## Release gates

The V8 demo is ready only when:

- all deterministic, property, authorization, and replay tests pass;
- the compatibility matrix is locked in manifests and lockfiles;
- local or equivalent cross-runtime lifecycle passes;
- every required live service path passes on devnet;
- ten sequential devnet rounds settle without manual state repair;
- each round proves token conservation;
- at least one live VRF tie and one timeout fallback are recorded;
- every withdrawal is confirmed by destination balance delta;
- frontend checks and production build pass;
- secret and generated-artifact scans pass;
- known limitations are current in README and submission copy.
