# FLINCH game rules

Historical token-exit design, superseded on 2026-09-05. See the current documents in docs/. Retained to explain the unmigrated Anchor program; not the current build specification.

## Canonical V8 rules

These rules define the product. Implementations and UI copy must not silently change them.

## Participants and stake

- A match has exactly four seats.
- Every seat deposits exactly `S` units of WSOL.
- Total pool balance at start is `4S`.
- Stakes cannot be changed after joining.
- One wallet may occupy only one seat in a round.
- A round cannot start until all four deposits are confirmed on the same ER.

## Time

- A round lasts 90 seconds from `started_at`.
- Time comes from the onchain Clock timestamp.
- SELL intents are grouped into two-second cohorts.
- A round ends when only one holder remains and all pending cohorts are resolved, or when the timer expires and a terminal cohort resolves.

## Player actions

- Every player begins as `Holding`.
- HOLD is passive and requires no transaction.
- A player may submit one irreversible SELL intent while `Live`.
- A sold player cannot re-enter.
- A player in a pending cohort cannot submit another intent.
- The last remaining holder cannot sell.
- A disconnected player continues holding.

## Penalty schedule

Penalty is determined by final sell rank, not network arrival within a cohort.

| Sell rank | Penalty on original stake |
| --- | ---: |
| First seller | 20% |
| Second seller | 12% |
| Third seller | 6% |
| Final holder | 0% |

The penalty uses the original equal stake `S`, not a player's changing claim. A seller's entitlement is:

`seller_payout = S - floor(S × penalty_bps / 10,000)`

All penalties remain in the pool until the final holder is known.

The final holder's entitlement is:

`holder_payout = S + sum(all seller penalties)`

For four players:

`sum(all payouts) = 0.80S + 0.88S + 0.94S + 1.38S = 4S`

No protocol rake or unassigned dust exists. Integer division is avoided because each percentage is calculated independently and the final holder receives the exact remaining pool balance.

## Simultaneous sells

Two or more SELL intents belong to the same cohort when they have the same integer cohort index:

`cohort = floor((clock_timestamp - started_at) / 2)`

The cohort records a bitmap of sellers. After the cohort closes:

- one seller: assign the next sell rank directly;
- multiple sellers: request MagicBlock VRF and enter `TiePending`;
- callback: shuffle the tied wallet indexes with unbiased rejection sampling and assign consecutive ranks;
- more intents than available exit ranks: VRF selects which player remains the final holder.

No new SELL intent is accepted while a tie callback is pending. Normal time continues.

If the VRF callback is not fulfilled within ten seconds, anyone may call `resolve_tie_timeout`. The tied cohort receives the average penalty amount for the unresolved ranks, and VRF does not decide the final holder. If every active player attempted to sell, the fallback selects the holder by the lowest wallet pubkey. This fallback is deterministic, value-conserving, and explicitly shown in the result.

The timeout average is calculated in base units, not floating point. Sum the normal penalties for the unresolved ranks, divide that total among the actual sellers, and assign any one-unit remainder in ascending wallet-pubkey order. If every active player attempted to sell, first remove the deterministic holder from the seller set.

## Timer expiry

At `ends_at`, no further voluntary SELL is accepted. If multiple players are still holding, they form one terminal cohort:

- VRF orders the forced sell ranks and leaves the final player as holder;
- forced sellers pay the penalties associated with the remaining sell ranks;
- if VRF times out, the lowest wallet pubkey becomes holder and the other players share the total unresolved rank penalty using the deterministic base-unit rule;
- if exactly one player remains, no terminal VRF request is needed.

This rule guarantees a single terminal holder and prevents a round from hanging when nobody voluntarily sells. The lobby must disclose it before deposits are accepted.

## Settlement

Seller entitlements become claimable on the ER after their cohort resolves. The game program transfers the entitlement between the Round and player token-account representations on the ER, signed by the Round PDA.

At terminal settlement:

- confirm there is exactly one holder;
- transfer the Round token account's complete remaining balance to the holder's token account;
- assert the pool balance is zero;
- record every final payout and the total;
- record the final oracle snapshot if a fresh one is available;
- transition the round to `Settled`.

The final holder receives the exact remaining token balance. This makes conservation independent of rounding.

## Price and volatility

The price does not alter the payout formula. It supplies the fear and timing context for a real token position.

- The selected asset for V8 is WSOL.
- The reference feed is MagicBlock SOL/USD.
- Record a fresh price when the round opens.
- Record a fresh price with each sell when available.
- Record a fresh closing price at settlement when available.
- If the oracle becomes stale, show `PRICE STALE` and reject the snapshot, but do not trap token settlement.
- A replay must distinguish verified oracle samples from client-only chart samples.

SELL means exiting the pooled position into the player's eSPL balance. It does not claim that WSOL was converted to stablecoins. Withdrawal and optional swapping are separate user-visible steps.

## Cancellation and refund

- A host may cancel only before the round starts.
- An expired funding room may be cancelled by anyone after its deadline.
- Cancellation returns each funded player's exact stake.
- A live round cannot be cancelled by the host.
- A failed client or disconnected player cannot block resolution.
- If the ER is unavailable, the UI stops new rooms and reports the current state. It must not claim a refund until delegated state can be safely resolved and returned.

## Invalid actions

Reject:

- joining twice;
- joining with the wrong mint or amount;
- joining after the room is full or live;
- SELL before start or after terminal state;
- duplicate SELL;
- SELL from a wallet that is not a player;
- SELL with an expired or incorrectly scoped session;
- resolution before a cohort closes;
- unauthenticated VRF callback;
- duplicate VRF callback;
- settlement with unresolved cohorts;
- payout to the wrong eATA owner or mint;
- withdrawal before ownership returns to base.

## Required invariants

1. `pool_start_balance = player_count × stake`.
2. `sum(player_payouts) = pool_start_balance`.
3. `pool_final_balance = 0` after all payouts.
4. `holding_count + pending_count + sold_count = funded_player_count` before finalization.
5. Each wallet has one seat and at most one sell rank.
6. Sell ranks are unique and contiguous from one.
7. Exactly one final holder exists at terminal state.
8. The sum of penalties equals `holder_payout - S`.
9. The token mint is identical for every player and Round token account and their eSPL records.
10. Every writable eATA and Round account used together is delegated to the same ER.

## Reference payout vector

For `S = 100,000,000` base units:

| Player | Result | Penalty | Payout |
| --- | --- | ---: | ---: |
| A | first seller | 20,000,000 | 80,000,000 |
| B | second seller | 12,000,000 | 88,000,000 |
| C | third seller | 6,000,000 | 94,000,000 |
| D | final holder | 0 | 138,000,000 |
| Total |  | 38,000,000 | 400,000,000 |

This vector is a mandatory deterministic test fixture.
