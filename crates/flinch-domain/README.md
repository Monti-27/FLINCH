# FLINCH domain

Allocation-free no_std Rust library. No Solana, Anchor, serialization, randomness, RPC or DEX dependency. This is the real-sales accounting model, not a deployed game program.

## Modules

| Module | Responsibility |
| --- | --- |
| allocation | Checked totals and proportional largest-remainder shares |
| economics | Flat current-entitlement penalty, holder rewards, exact net input |
| cohort | Start-anchored windows and expiry |
| sellers | Bounded, nonempty four-seat mask |
| batch | Immutable proposal, snapshot, revision, per-seller output minima |
| ledger | Base economic-state model, atomic value transitions, recovery and claims |

`Ledger::new` models an already fully funded and started round. It does not perform or verify deposits. Economic minima and deterministic timing use base units and caller-supplied integer timestamps; the future program must obtain timestamps from Clock and inputs from authenticated accounts.

`prepare_batch` is not authorization and does not lock the ledger. The future onchain Control account owns the single pending batch, intent nonces, session checks and attempt limits. Only a batch reconstructed from that canonical account may reach a real swap. Distinct proposals of the same revision are alternatives, not independently executable authorizations.

`apply_fill` accepts observed input/output amounts for deterministic validation. Production callers must derive them from token-account deltas around the actual CPI. Returning Ok in a native test does not prove a swap took place. Errors leave the original ledger unchanged, but CPI rollback requires runtime tests.

USDC claims may be consumed while another batch is pending; claims do not change its economic revision. Successful fills and expired batches increment revision. Past cohorts cannot be reopened after settlement/expiry. Recovery terminalizes the ledger without needing the pending proposal. Token types are kept in separate named fields and conservation equations.

Run `bash scripts/verify-domain.sh` from the workspace. Tests cover exhaustive bounded sell partitions, integer grids, minima, replay and recovery. Do not infer runtime account authorization, actual token movement, market behavior or mainnet safety from these tests.
