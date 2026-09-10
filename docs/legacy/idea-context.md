# Idea context

Historical token-exit context, superseded on 2026-09-05 by docs/DECISIONS.md.

## Product

FLINCH is a four-player, 90-second PvP stonk battle on Solana. Every player deposits the same WSOL stake. Selling early returns the player's stake minus a rank penalty. Those penalties remain in the pool for the final holder.

Tagline: `Sell first. Pay the holders.`

## Canonical rules

- four players;
- one WSOL stake size per room;
- 90 seconds;
- two-second sell cohorts;
- 20%, 12%, and 6% sell penalties;
- one final holder;
- no protocol fee;
- exact token conservation;
- MagicBlock VRF orders same-cohort sells;
- deterministic value-conserving fallback after ten seconds;
- at timer expiry, remaining holders form a terminal VRF cohort;
- SELL exits to eSPL WSOL, not USDC.

## MagicBlock stack

- public Ephemeral Rollup for live shared state;
- Ephemeral SPL Token for WSOL-backed ER balances;
- Session Keys for one no-popup SELL;
- Pricing Oracle for SOL/USD context only;
- scoped VRF for tied cohorts and terminal selection;
- Solana base for durable result and withdrawal.

## Critical boundaries

- base creates and delegates;
- router discovers the ER;
- delegated writes, commits, and undelegation originate on the ER;
- all writable delegated accounts must share one validator/FQDN;
- ER confirmation is not base settlement;
- base settlement is not withdrawal;
- session authorization is not token authority;
- oracle availability cannot block payout;
- VRF acceptance is not callback completion.

## Start here

Read `README.md`, `AGENTS.md`, `docs/DECISIONS.md`, `docs/GAME_RULES.md`, `docs/ARCHITECTURE.md`, `docs/MAGICBLOCK.md`, and `docs/LLM_HANDOFF.md`.

Implementation begins with the dependency and token-lifecycle compatibility spike in `docs/BUILD_PLAN.md`.

## Scope exclusions

No PER, mainnet, rake, Jupiter auto-swap, arbitrary tokens, tournaments, NFTs, chat, clans, leverage, liquidation, or fake offchain balances in V8.
