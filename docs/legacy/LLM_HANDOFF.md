# FLINCH LLM handoff

Historical token-exit design, superseded on 2026-09-05. See the current documents in docs/. Retained to explain the unmigrated Anchor program; not the current build specification.

## Mission

Build FLINCH, the original MagicBlock PvP stonk battle: four players stake equal WSOL, play one 90-second game of chicken, and every seller pays a rank penalty that remains for the final holder.

Tagline: **Sell first. Pay the holders.**

## Current state

The repository now contains a modular Anchor program for the complete deterministic game lifecycle. Native formatting, tests, and strict linting pass, and an SBF artifact plus IDL can be generated with `scripts/verify-program.sh`.

The dependency family is Anchor `1.0.2`, `ephemeral-rollups-sdk` `0.17.0` with `anchor` and `vrf`, Session Keys `3.1.1`, and `ephemeral-spl-api` pinned to commit `7288a12befccc5541f3411b03699ba0f57e6c078`. The ER SDK `spl` feature is intentionally disabled because it activates host-side encryption dependencies that do not compile for SBF. The eSPL boundary instead uses official API discriminators, arguments, and PDA helpers.

No Git repository, deployment, local validator cycle, devnet run, oracle consumer, client package, or frontend exists yet. The program ID remains a placeholder until deployment setup is explicitly requested.

Do not continue V8 work in `/Users/montisaini/magic-block-challenge`; that is the completed V7 BlitzMine repository.

## Read before acting

1. `AGENTS.md`
2. `docs/DECISIONS.md`
3. `docs/GAME_RULES.md`
4. `docs/ARCHITECTURE.md`
5. `docs/MAGICBLOCK.md`
6. `docs/PROGRAM.md`
7. `docs/TESTING.md`
8. `docs/BUILD_PLAN.md`
9. `docs/SOURCES.md`

For any MagicBlock change, load `/Users/montisaini/.agents/skills/magicblock-dev-skill/skill/SKILL.md` and the references it routes to.

## Non-negotiable product rules

- exactly four players;
- equal WSOL stakes;
- 90-second round;
- one irreversible SELL per player;
- two-second sell cohorts;
- penalties of 20%, 12%, and 6%;
- no protocol fee;
- VRF orders tied cohorts;
- timeout fallback preserves every token unit;
- last holder cannot sell;
- terminal timeout must still produce one holder;
- price is contextual and never controls payout;
- SELL returns WSOL entitlement, not USDC;
- devnet only for V8.

## Non-negotiable architecture rules

- `#[ephemeral]` appears before `#[program]`.
- Use current `MagicIntentBundleBuilder`, not deprecated commit helpers.
- Base initializes and delegates; ER mutates delegated state and initiates commit/undelegation.
- Resolve ER placement with router `getDelegationStatus`.
- Every writable Round/eSPL account in a transaction must share one verified validator/FQDN.
- The Round PDA controls the pool token account.
- Actual tokens remain backed by the eSPL Global Vault.
- Session authorization and token authority are independent.
- Use scoped VRF request and callback macros; bind nonce and cohort.
- Oracle snapshots validate account, feed ID, exponent, posting slot, publish time, positivity, and checked arithmetic.
- Oracle failure never blocks token settlement.
- Confirm base commitment and restored ownership before withdrawal.
- Do not add PER, Cranks, Magic Actions, Private Payments, or Jupiter to the critical path.

## Next task

Build instruction-level runtime tests and the local base-to-ER-to-base custody harness. Do not treat the generated SBF artifact as proof that eSPL custody, VRF callbacks, Session Keys, commit, or withdrawal work at runtime.

## Highest-risk assumptions

1. Pool-PDA eSPL bootstrap works cleanly with the current unpublished API crate workspace layout.
2. Round, player token state, oracle, and VRF queue can be made available on the same devnet ER.
3. The scoped VRF callback can fit rank assignment and token transfers within compute/account limits.
4. The chosen withdrawal builder reliably returns WSOL after the latest eSPL changes.
5. Session accounts are readable in the target ER without weakening authorization.

Test these before visual polish.

## Required implementation discipline

- inspect repository state and governing files before edits;
- write code with no comments;
- use checked integer arithmetic;
- avoid copied external program bytes and guessed PDA seeds;
- keep one canonical protocol constants module;
- preserve unrelated changes;
- never commit secrets or local keypairs;
- keep commit titles short, natural, and without prefixes or emojis;
- do not initialize Git, deploy, or publish without the user's explicit instruction.

## Completion evidence

The final implementation handoff must include:

- exact versions and program IDs;
- build, lint, unit, integration, and frontend results;
- ten sequential devnet run artifacts;
- base and ER signatures;
- VRF request and callback signatures;
- before/after token balances proving conservation;
- commit and withdrawal signatures;
- current limitations and unverified claims.

Without that evidence, describe the project as incomplete.

## Product shorthand

When context is tight, retain this sentence:

> FLINCH is a four-player, 90-second WSOL game on one public MagicBlock ER: sellers pay 20%, 12%, then 6% of their original stake, same-cohort sells are VRF ordered, the final holder receives the exact remaining pool, and eSPL balances return to Solana through separately confirmed settlement and withdrawal.
