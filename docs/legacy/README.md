# FLINCH

Historical token-exit design, superseded on 2026-09-05. See the current documents in docs/. Retained to explain the unmigrated Anchor program; not the current build specification.

**Sell first. Pay the holders.**

FLINCH is a real-time PvP game on Solana where four players pool equal token stakes, watch a live market price, and decide when to exit. Every seller gives up part of their position to the players still holding. The last remaining holder receives every accumulated penalty.

The V8 build uses actual WSOL balances on devnet. MagicBlock Ephemeral Rollups run the live match, Ephemeral SPL Token provides fast token custody, Session Keys remove repeated wallet prompts, the Pricing Oracle records the live SOL/USD context, and VRF resolves simultaneous sells.

## Current status

The core Anchor program is implemented. It includes the round state machine, exact payout accounting, two-second sell cohorts, scoped VRF resolution with a deterministic timeout, Session Key authorization for SELL, eSPL pool initialization, terminal settlement, cancellation, refunds, and round commit/undelegation.

Native checks and the SBF build pass. The generated program has not been deployed or exercised against the local MagicBlock stack or devnet, so cross-runtime custody, live VRF, sessions, and withdrawal remain unverified.

No frontend has been started.

## Core layout

```text
programs/flinch/src/
  domain/          deterministic game rules and token economics
  state/           bounded onchain account types
  instructions/    one module per protocol transition
  integrations/    typed external-program boundaries
```

## Verify the program

```bash
./scripts/verify-program.sh
```

The current dependency graph needs Solana platform-tools `v1.53` or newer because transitive crates use Rust 2024 metadata. Anchor IDL generation uses `--skip-lint` because this repository's code policy forbids comments, including Anchor `CHECK` comments. All unchecked accounts still have explicit address, PDA, owner, mint, or state validation in constraints or handlers.

## Canonical V8 scope

- Four-player rooms
- Equal WSOL stakes
- One 90-second round
- One irreversible SELL action per player
- Rank-based penalties: 20%, 12%, and 6%
- One final holder who receives all penalties
- Two-second exit cohorts
- VRF ordering for simultaneous exits
- Session-authorized gameplay
- ER-native token transfers with eSPL
- Safe withdrawal to Solana after exit or settlement
- Live SOL/USD price context and replay
- Devnet only

## Read this first

1. [Product specification](docs/PRODUCT.md)
2. [Game rules](docs/GAME_RULES.md)
3. [Architecture](docs/ARCHITECTURE.md)
4. [MagicBlock integration](docs/MAGICBLOCK.md)
5. [Program specification](docs/PROGRAM.md)
6. [Frontend and demo](docs/FRONTEND.md)
7. [Security and recovery](docs/SECURITY.md)
8. [Testing strategy](docs/TESTING.md)
9. [Implementation plan](docs/BUILD_PLAN.md)
10. [Decisions and open questions](docs/DECISIONS.md)
11. [Source ledger](docs/SOURCES.md)
12. [LLM handoff](docs/LLM_HANDOFF.md)

The research synthesis is in [report-source.md](report-source.md).

The machine-readable account, routing, settlement, and validation plan is in [architecture-manifest.yaml](docs/architecture-manifest.yaml).

## Product boundary

SELL means exiting the shared game position and receiving the remaining target-token entitlement. It does not claim that a Jupiter swap into USDC has completed. The V8 demo can unwrap WSOL after withdrawal; an atomic token-to-stable exit is intentionally outside the critical path.

## Definition of success

A judge can join a room, authorize one short-lived session, watch other players sell, see penalties move to remaining holders, observe a VRF tie, survive the final countdown, and withdraw the correct token amount. The full path must be demonstrated with Solana and ER signatures and without manual state repair.
