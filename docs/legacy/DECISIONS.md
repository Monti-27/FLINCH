# FLINCH decisions and open questions

Historical token-exit design, superseded on 2026-09-05. See the current documents in docs/. Retained to explain the unmigrated Anchor program; not the current build specification.

This is the canonical decision log. Change a locked decision only with an explicit replacement entry and update every affected specification.

## Locked decisions

### D001: Build the original stonk-battle idea

FLINCH is a timed game of chicken around one real token position. It is not a prediction market, paper-trading simulator, perpetuals game, or social-deception spin-off.

### D002: Use devnet WSOL

The V8 build uses WSOL base units on MagicBlock-compatible Solana devnet. The interface may show SOL/USD context but never claims a seller received stablecoins.

Reason: real token movement makes the MagicBlock integration visible while keeping the hackathon away from mainnet risk.

### D003: Exactly four players and one 90-second round

Fixed rules create a legible demo, bounded account size, bounded callback work, and repeatable tests. Variable lobbies are post-V8.

### D004: Use seller-rank penalties

The first three sell ranks pay 20%, 12%, and 6% of the original equal stake. The last holder receives the exact remaining pool. There is no rake.

### D005: Two-second cohorts remove click-speed ordering

Sells in the same onchain two-second cohort are simultaneous. A multi-seller cohort uses VRF to assign available sell ranks.

Reason: raw transaction ordering would turn the game into an RPC-latency contest and invite priority manipulation.

### D006: The timer always produces a terminal result

At 90 seconds, all remaining holders enter one terminal cohort. If more than one remains, VRF orders the required forced sell ranks and leaves one final holder. If VRF times out, the lowest wallet pubkey is the holder and the other tied players share the total unresolved rank penalty deterministically.

Reason: the round must never hang because players refuse to act. The UI explains the terminal draw before funding.

### D007: Use a public ER, not PER

Player state and sells are intentionally visible. Social pressure is the product, so private actions would weaken the original idea and increase scope.

### D008: Price is context, not a payout oracle

The MagicBlock SOL/USD feed drives tension, snapshots, and replay. Rank and token payout depend only on sell behavior. Oracle failure cannot trap the pool.

### D009: SELL exits to eSPL balance

SELL transfers the player's entitlement out of the shared pool into their ER token balance. It does not execute a Jupiter swap. Return to Solana, WSOL unwrap, and any external swap are separate stages.

### D010: Session Keys authorize only SELL

Wallets sign funding, session creation, recovery, withdrawal, and account closure. A short-lived session signs only `queue_sell`. No token delegate is needed after stake custody has moved to the Round.

### D011: Use eSPL-backed token custody

The actual WSOL is locked in the eSPL Global Vault. The Round and player token balances operate on the ER, pinned to one validator. A database balance or fake chip ledger is not acceptable for the submission.

### D012: Use the official pool-PDA composition pattern without copied bytes

Pool bootstrap uses the direct eSPL API because the Round PDA owns the pool. Player lifecycle uses current SDK builders, and live transfers use SPL Token CPI on the ER. The implementation must consume upstream API types/builders, not manually encode instruction discriminators from the example.

### D013: Terminal settlement is separate from withdrawal

The UI distinguishes ER-settled, base-confirmed, withdrawable, and withdrawn. A player result is economically assigned on ER before it is available in the wallet on Solana.

### D014: No frequent commits or fee vault for V8

The Round needs one terminal commit. User token accounts follow the eSPL return lifecycle. The default sponsored commit allowance is sufficient unless measurement disproves the assumption.

### D015: One human plus three real bot participants is allowed for demo

Bots use ordinary keys, deposits, sessions, and program instructions. They do not bypass the protocol or fabricate chain state.

### D016: Planning stays separate from BlitzMine

FLINCH lives in `/Users/montisaini/flinch`. The completed V7 repository at `/Users/montisaini/magic-block-challenge` is reference-only and must not receive V8 work.

## Open implementation decisions

These do not change the product, but they must be closed during the named milestone.

| ID | Question | Default | Close by |
| --- | --- | --- | --- |
| O001 | Exact minimum and maximum WSOL stake | safe devnet presets only | compatibility spike |
| O002 | Which devnet validator region | lowest stable measured latency | Phase 2 |
| O003 | Default shuttle or legacy explicit withdrawal | whichever passes full pinned-version cycle most reliably | compatibility spike |
| O004 | Does pool bootstrap require a nonzero seed balance | zero if supported; otherwise explicitly excluded refundable seed | compatibility spike |
| O005 | Can VRF payout work fit one callback compute budget | use separate idempotent `apply_cohort` if uncertain | Phase 4 |
| O006 | Which local service harness can prove VRF | official example harness if `mb-stack` lacks configured VRF | compatibility spike |
| O007 | Session secret storage | memory only, with direct-wallet recovery | frontend spike |
| O008 | Oracle maximum age | start at 30 seconds, validate against actual devnet cadence | Phase 5 |

## Rejected directions

| Direction | Reason rejected for V8 |
| --- | --- |
| centralized game server | makes custody and ordering trusted and weakens MagicBlock relevance |
| raw first-transaction ranking | rewards network latency and priority manipulation |
| PER-hidden sells | contradicts the visible game-of-chicken premise |
| automatic Jupiter swap on SELL | adds liquidity, slippage, and asynchronous failure to the critical path |
| fake test credits only | does not prove eSPL custody or withdrawal |
| arbitrary tokens | multiplies mint, decimals, oracle, and liquidity cases |
| mainnet deposits | requires legal, operational, audit, and incident-response work outside the hackathon |
| recurring Crank | the round can be progressed permissionlessly by clients or a simple keeper |
| Magic Actions | no required base-side effect must be atomic with the terminal commit |
| protocol fee | obscures conservation and introduces unnecessary economics |

## Change protocol

Before changing a locked decision:

1. state the user-visible reason;
2. list affected invariants and documents;
3. add a replacement decision with date;
4. update the architecture manifest;
5. add or change the required tests before implementation.
