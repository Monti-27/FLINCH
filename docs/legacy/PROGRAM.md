# FLINCH program specification

Historical token-exit design, superseded on 2026-09-05. See the current documents in docs/. Retained to explain the unmigrated Anchor program; not the current build specification.

## Program responsibility

The program owns the game rules, the Round state, pool authority, sell ordering, penalty arithmetic, payout transfers, and terminal receipt. The browser and optional keeper may trigger instructions but cannot choose outcomes.

## Constants

| Constant | V8 value |
| --- | ---: |
| player capacity | 4 |
| round duration | 90 seconds |
| cohort duration | 2 seconds |
| VRF timeout | 10 seconds |
| basis-point denominator | 10,000 |
| rank 1 penalty | 2,000 bps |
| rank 2 penalty | 1,200 bps |
| rank 3 penalty | 600 bps |
| protocol fee | 0 |

Stake bounds and oracle maximum age remain deployment configuration and must be fixed before devnet deployment.

## PDA model

Proposed stable seeds:

| Account | Seeds |
| --- | --- |
| Round | `b"round"`, host pubkey, host nonce bytes |
| round authority | the Round PDA itself |

The eSPL program derives eATA and Global Vault PDAs with its own public API. The Session Keys program derives `SessionTokenV2`. FLINCH must not duplicate external seed constants when an SDK derivation exists.

## Round state

The implementation keeps one bounded Round account allocated with Anchor's generated `INIT_SPACE`.

```text
Round
  version: u8
  bump: u8
  status: RoundStatus
  host: Pubkey
  host_nonce: u64
  mint: Pubkey
  validator: Pubkey
  pool_token_account: Pubkey
  price_account: Pubkey
  price_feed_id: [u8; 32]
  stake: u64
  created_at: i64
  funding_deadline: i64
  started_at: i64
  ends_at: i64
  next_sell_rank: u8
  holding_count: u8
  funded_count: u8
  active_cohort: Cohort
  vrf: VrfState
  players: [PlayerSlot; 4]
  opening_price: PriceSample
  closing_price: PriceSample
  total_paid: u64
  terminal_pool_balance: u64
  terminal_reason: TerminalReason
```

```text
PlayerSlot
  wallet: Pubkey
  token_account: Pubkey
  state: PlayerState
  sell_rank: u8
  sell_cohort: u32
  sell_timestamp: i64
  penalty_paid: u64
  payout: u64
  payout_claimed: bool
  last_action_nonce: u64
```

```text
Cohort
  index: u32
  closes_at: i64
  seller_bitmap: u8
  seller_count: u8
  status: CohortStatus
```

```text
VrfState
  request_nonce: u64
  cohort_index: u32
  seller_bitmap: u8
  first_rank: u8
  rank_count: u8
  requested_at: i64
  status: VrfStatus
```

```text
PriceSample
  value: i64
  exponent: i32
  publish_time: i64
  posted_slot: u64
  valid: bool
```

All arrays are fixed-size. Do not store variable-length vectors or strings in the Round.

## Enums

```text
RoundStatus = Funding | Ready | Live | TiePending | Finalizing | Settled | Cancelled
PlayerState = Empty | Funded | Holding | PendingSell | Sold | FinalHolder | Refunded
CohortStatus = Empty | Open | AwaitingVrf
VrfStatus = None | Requested | Fulfilled | TimedOut
TerminalReason = None | OneHolder | TimerExpired | Cancelled
```

Client lifecycle labels such as `Undelegating`, `Withdrawable`, and `Withdrawn` must not be written into the shared Round because the delegated program cannot authoritatively observe every later base-layer action.

## Instruction set

### `initialize_round`

Runtime: base.

Inputs: host nonce, stake, funding deadline, oracle configuration, validator identity.

Rules:

- initialize a unique Round PDA;
- enforce exactly four seats and canonical timing/penalty constants;
- require WSOL mint for V8;
- validate stake within deployment bounds;
- freeze economic parameters at creation;
- initialize status as `Funding` only after the pool custody setup is ready.

### `delegate_round`

Runtime: base.

- use `#[delegate]` and the exact Round seeds;
- pin to the same validator selected for the eSPL accounts;
- accept only the host while the room is not live;
- perform no gameplay mutation.

### `join`

Runtime: ER.

- require `Funding` or `Ready` and a wallet signer;
- verify the wallet is not already seated;
- verify the player's token account owner and WSOL mint;
- verify exact available stake and Round pool account;
- transfer exactly `stake` into the pool with SPL Token CPI;
- write the player seat only in the same successful transaction;
- transition to `Ready` when seat four joins.

Player eSPL deposit and delegation happen before this program instruction through the eSPL SDK lifecycle.

### `cancel_round`

Runtime: ER.

- host may call before start;
- anyone may call after the funding deadline;
- return exact deposits to each funded player's ER token account;
- mark each refund once;
- require the pool to reach its pre-funded remainder or zero, depending on the chosen bootstrap model;
- transition to `Cancelled` only after every funded seat is refunded.

The compatibility spike must decide whether the pool begins at zero or carries a minimal bootstrap balance. Production accounting must exclude and recover any bootstrap amount explicitly.

### `start_round`

Runtime: ER.

- require `Ready` and four funded seats;
- accept the host or become permissionless after a short ready grace period;
- set `started_at` once from Clock and derive `ends_at` with checked addition;
- set every funded seat to `Holding`;
- capture a valid opening price when available;
- transition to `Live`.

### `queue_sell`

Runtime: ER. Wallet or valid session.

- validate the wallet/session binding and player seat;
- require `Live`, `Holding`, and current time before `ends_at`;
- reject when a prior cohort is awaiting VRF;
- reject if only one holder remains;
- require a strictly increasing action nonce;
- compute cohort index from onchain time;
- set the seller bit once and move the player to `PendingSell`;
- record a valid oracle sample if supplied, otherwise record unavailable;
- never transfer tokens or assign a rank before the cohort resolves.

### `resolve_cohort`

Runtime: ER. Permissionless.

- require the cohort close time has passed;
- reject empty or already resolved cohorts;
- calculate how many seller ranks remain before a final holder must remain;
- for one effective seller, assign the next rank and payout directly;
- for multiple sellers, store a nonce-bound VRF request and transition to `TiePending`;
- if every holder tried to sell, leave one holder slot for either VRF selection or timeout fallback.

The instruction should keep callback work bounded. If one callback plus all token transfers exceeds compute/account limits, callback stores the final order and a separate permissionless `apply_cohort` instruction performs idempotent payouts.

### `consume_tie_randomness`

Runtime: ER VRF callback.

- use `#[vrf_callback]` authentication;
- require matching Round, cohort, seller bitmap, rank range, and request nonce;
- reject fulfilled, timed-out, superseded, or malformed requests;
- derive an unbiased permutation;
- reserve one final holder when sellers exceed available ranks;
- store the order before applying economic effects;
- process each seller payout once;
- advance the cohort and return to `Live` or `Finalizing`.

### `resolve_tie_timeout`

Runtime: ER. Permissionless.

- require `TiePending` and at least ten seconds since the persisted request time;
- mark the request timed out before transfers;
- if every active player submitted SELL, select the lowest wallet pubkey as holder;
- compute the total base-unit penalty for the unresolved sell ranks;
- divide that total across actual sellers, assigning any one-unit remainder in ascending wallet order;
- pay each seller `stake - assigned_penalty`;
- preserve the exact sum of the original rank penalties;
- ignore any later callback for that nonce.

This definition avoids fractional basis-point ambiguity and preserves every token unit.

### `apply_cohort`

Runtime: ER. Permissionless and optional if callbacks can safely finish atomically.

- require a stored resolved order;
- transfer each unpaid seller entitlement from the Round token account;
- set `payout_claimed` in the same transaction as each transfer;
- support bounded progress without changing rank order;
- become a no-op when all cohort payouts are complete.

### `finalize_round`

Runtime: ER. Permissionless.

- require one holder and no unresolved cohort;
- permit finalization when one holder remains or `ends_at` has passed;
- if time expired with multiple passive holders, request VRF to choose a final holder or apply the documented deterministic timeout path;
- transfer the exact complete remaining pool balance to the holder;
- require the pool balance reaches zero;
- store every payout, total paid, terminal reason, and optional closing price;
- transition to `Settled` once.

The timer-expiry case is an implementation gate: the current game promise needs exactly one final holder even if nobody sells. V8 should use VRF to select among remaining holders at expiry, with the same authenticated, nonce-bound, timeout-safe state machine. The UI must call this a timed survival winner, not a sell rank.

### `commit_round` and `undelegate_round`

Runtime: ER.

- use `#[commit]` and `MagicIntentBundleBuilder`;
- commit only a coherent terminal receipt;
- require `Settled` or `Cancelled` for undelegation;
- use the default sponsored commit allowance unless measurement proves otherwise;
- expose the ER signature so the client can extract and confirm the base signature.

Token eATA return and withdrawal use the eSPL lifecycle rather than these Round instructions.

## Arithmetic

For each sell rank:

```text
penalty = floor(stake * penalty_bps / 10_000)
payout = stake - penalty
```

Use a widened integer for multiplication and checked conversion back to `u64`. Never calculate token balances with floating point.

Normal resolution leaves all penalty units in the pool. The final holder receives the exact remaining balance, so integer rounding cannot create stranded dust.

Timeout resolution calculates the sum of the normal base-unit penalties first, then divides it among tied sellers. Any remainder is allocated deterministically by ascending wallet pubkey. This changes which tied seller pays at most one base unit while preserving total economics.

## VRF permutation

Use a Fisher-Yates shuffle with rejection sampling:

1. Treat successive VRF bytes as an unsigned candidate stream.
2. For range size `n`, reject candidates at or above the largest multiple of `n` representable by the sample width.
3. Map the accepted candidate into `[0, n)`.
4. Swap and continue until the bounded seller list is ordered.

Four seats keep the callback deterministic and small. Tests must use fixed randomness vectors.

## Events

Emit compact events for indexers and the demo replay:

- `RoundCreated`
- `PlayerJoined`
- `RoundStarted`
- `SellQueued`
- `TieRequested`
- `TieResolved`
- `TieTimedOut`
- `SellerPaid`
- `HolderPaid`
- `RoundSettled`
- `RoundCancelled`
- `RoundCommitRequested`

Every event includes the Round key. Economic events include wallet, token amount, and rank where applicable. VRF events include the request nonce and cohort index.

## Error families

- lifecycle: wrong state, too early, expired, already terminal;
- player: duplicate seat, not seated, already sold, last holder cannot sell;
- session: wrong authority, signer, target, expiry, or nonce;
- token: wrong mint, owner, token program, account, amount, or insufficient balance;
- placement: account not delegated or inconsistent validator/FQDN;
- cohort: wrong index, still open, empty, already resolved, unresolved predecessor;
- VRF: unauthenticated, wrong nonce, duplicate, late, wrong queue;
- oracle: wrong account/feed/exponent, stale, zero, negative, overflow;
- arithmetic: overflow, invalid penalty schedule, conservation failure;
- settlement: unresolved payout, pool nonzero, total mismatch.

## Program invariants

Every state transition must preserve the invariants in [GAME_RULES.md](GAME_RULES.md). In addition:

- the Round's mint, pool account, validator, stake, and penalty schedule never change after funding starts;
- one session-authorized action maps to one stored wallet seat;
- a VRF nonce changes at most one cohort or terminal selection;
- `total_paid + current_pool_balance` equals the funded pool throughout live play;
- `Settled` implies all seller entitlements are transferred and exactly one holder is paid;
- oracle failure never changes rank, payout, or settlement availability.
