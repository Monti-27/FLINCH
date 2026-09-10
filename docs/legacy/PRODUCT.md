# FLINCH product specification

Historical token-exit design, superseded on 2026-09-05. See the current documents in docs/. Retained to explain the unmigrated Anchor program; not the current build specification.

## Product sentence

FLINCH is a 90-second multiplayer game of chicken where players pool equal amounts of one token and every early seller pays the players who keep holding.

## Promise

The user should understand the entire game in one sentence:

> Hold longer to collect more of the pot. Sell sooner to escape, but pay everyone who stayed.

## Audience

### Primary

- crypto-native friends who already understand holding and paper hands
- streamers and community hosts who need a short spectator-friendly game
- hackathon judges evaluating real-time Solana applications

### Not the V8 audience

- professional traders seeking execution quality
- users seeking a yield product
- users expecting a regulated investment product
- institutions requiring production custody and compliance controls

## Core loop

1. A host creates a four-seat room with one fixed WSOL stake.
2. Players join and deposit the exact stake.
3. Each player authorizes a match-scoped Session Key.
4. The room opens for 90 seconds.
5. Players watch the live SOL/USD price and each other.
6. A player may submit SELL once.
7. The seller receives their original token stake minus the penalty for their exit rank.
8. The forfeited amount stays in the pool for remaining holders.
9. If several players sell in the same two-second cohort, VRF orders them.
10. The last holder receives their stake plus the entire penalty pool.
11. Every player can return their eSPL balance to Solana and unwrap WSOL.

## Why it is fun

- The decision is legible: stay or leave.
- Every exit visibly makes the remaining position more valuable.
- The live price creates urgency without determining the protocol payout.
- A simultaneous panic produces a verifiable random reveal.
- The final holder has a clear social victory.
- A complete match is short enough to watch and replay.

## Why Solana and MagicBlock matter

The game can be simulated on a centralized server, but that would require trusting the operator with the stake, sell ordering, and payout. FLINCH uses:

- Solana for durable token ownership and final withdrawal.
- ER for the low-latency shared game state.
- eSPL for actual token transfers within the ER.
- Session Keys for an uninterrupted match.
- VRF for fair ordering when the protocol cannot distinguish simultaneous intent.
- Pricing Oracle for authenticated market context and the post-match replay.

## MVP configuration

- Network: MagicBlock devnet
- Asset: WSOL
- Reference feed: SOL/USD
- Players: exactly four
- Stake: one host-selected amount within a hardcoded safe range
- Duration: 90 seconds
- Cohort length: two seconds
- Exit penalty schedule: 20%, 12%, 6%
- Winner: the final holder
- Fee: zero protocol rake
- Match discovery: direct invite link plus one public demo room

## Product states

1. `Draft` — host chose parameters; no stake accepted.
2. `Funding` — room and pool are routed; players may join.
3. `Ready` — four funded players; sessions may be authorized.
4. `Live` — sell intents are accepted.
5. `TiePending` — a cohort requires VRF resolution.
6. `Finalizing` — timer ended or one holder remains; payouts are being credited.
7. `Settled` — every player entitlement exists on the ER.
8. `Undelegating` — Round and token accounts are returning to base.
9. `Withdrawable` — base ownership is restored and users may withdraw.
10. `Closed` — pool is empty and terminal receipt is durable.
11. `Cancelled` — pre-start refund path.

`Draft` through `Settled`, plus `Cancelled`, are protocol states. `Undelegating`, `Withdrawable`, and `Closed` are client lifecycle states derived from router status, base ownership, and observed token balances; the UI must not pretend the Round program can see a user's completed withdrawal.

## Experience principles

- The chart is the room, not one panel among many.
- HOLD is the default state and requires no repetitive action.
- SELL is singular, irreversible, and always shows the exact penalty first.
- The UI displays token amounts first and USD values second.
- The app distinguishes pending, ER-confirmed, base-confirmed, and withdrawn.
- No casino confetti, fake profit claims, or misleading “instant cashout” copy.

## Success metrics

- A first-time player explains the rule after seeing one match.
- A four-player room starts in under 30 seconds with bots filling empty seats.
- No wallet prompt appears during active gameplay after session authorization.
- Sell acknowledgement p95 is measured and displayed during testing.
- Ten sequential devnet matches settle and withdraw without manual repair.
- The submission video shows the entire lifecycle in under three minutes.

## Non-goals

- price prediction payouts
- leverage or liquidation
- order books or portfolio construction
- private strategies or PER
- tournament brackets and seasons
- mainnet deposits
- protocol fees
- automatic Jupiter liquidation
- more than one asset in the first release
