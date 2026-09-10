# FLINCH program boundary

## Current implementation

`crates/flinch-domain` models pure economics and a settlement ledger with a validated snapshot/restore boundary. It cannot authenticate a wallet, read Clock, authorize a batch, invoke Raydium, or transfer a token. Its successful return is not an onchain receipt.

`programs/flinch-v2` implements the replacement instructions below. Base vault deltas come from actual SPL/Raydium execution. Wallet/session authorization and replay guards are program responsibilities. Local SBF tests and two real MagicBlock stack scenarios pass; public devnet is unverified. The current program ID is an undeployed test identifier, not a release address.

`programs/flinch` is the old eSPL/VRF program. Its previous tests remain regression checks, not evidence that the new model is deployed. The old IDL must not be used as a client contract for this migration.

## Replacement instructions

Keep each instruction in its own module with small reusable account validators and typed integration modules:

| Instruction | Responsibility |
| --- | --- |
| initialize_room | Create versioned Ledger and token vaults with fixed terms and allowlisted pool |
| join_room | Wallet transfer_checked and unique-seat assignment atomically |
| cancel_room / refund | Pre-start cancellation or elapsed funding deadline; exact one-shot refunds |
| start_round | Start full room once from Clock; initialize matching Control snapshot |
| set_session_signer | Funded wallet binds its room session signer before start; immutable afterward |
| delegate_control | Delegate only prepared, current Control to stored validator |
| queue_sell | Authenticate wallet/session; bind room, minimum, nonce, attempt cap and cohort |
| freeze_batch | Freeze complete closed cohort and request control commit-and-undelegate |
| execute_batch | Validate returned control and Raydium accounts; swap, reload, apply domain result, write receipt |
| expire_batch | Consume expired revision without transferring assets; synchronize Control |
| recover_round | Terminalize base Ledger at hard cutoff without Control |
| claim_usdc / claim_wsol | Authenticate stored wallet; transfer exact entitlement and consume claim atomically |

Do not use dynamic account vectors in stored Ledger/Control. Four seats, one active batch, bounded attempts, versioned discriminators/layouts. Define serialized Anchor DTOs in state/, explicitly validate decoded fields, then construct domain values. Private Rust fields do not validate deserialized bytes or replace onchain constraints.

Funding deadline is fixed at 300 seconds after initialization. Control phases are Prepared → Live → Frozen → Resolved; only the SDK delegation path enters Live, only the Magic Program path enters Frozen. Ledger and vaults never delegate. Execute validates the returned batch before CPI and stores the result only after actual token deltas satisfy every seller's minimum. Boxed account wrappers keep ExecuteBatch within SBF stack limits.

The Raydium interface is generated with Anchor `declare_program!` from `idls/raydium_cp_swap.json`. Provenance records the upstream commit and the devnet address substitution. Token-2022 support is enabled only for Anchor SPL's IDL-generation compatibility; production transfers remain restricted to ordinary SPL Token and the two fixed mints.

## Domain public interfaces

- `SellerSet` validates a nonzero four-seat bitmap.
- `ExitEconomics` calculates current-entitlement penalties, net swap inputs and resulting holder balances.
- `CohortWindow` calculates two-second windows and the exact expiry boundary.
- `ExitBatch` is an immutable round/revision/snapshot-bound economic proposal with per-seat minima.
- `Ledger` prepares proposals, applies observed fills, expires proposals, recovers after cutoff, and consumes claims.

No production program may accept a client-serialized ExitBatch as authorization. Derive it from the canonical authenticated Control and current Ledger. `apply_fill` requires deltas read around the actual CPI, never user-supplied claimed deltas. Domain minima are bounds, not price-oracle assertions.

## Program validation contract

Check signers, exact room seeds/versions, canonical returned Control owner and phase, round/revision match, immutable snapshot, nonce/attempt state, Clock, token programs, native WSOL mint, Circle devnet USDC mint, vault authority, fixed destination ATAs, pool config and pool reserves. Reject aliasing across source/destination/vault roles. Fail before CPI when possible; reload accounts after it.

The onchain code must perform `swap + ledger + receipt + Control result` in one transaction. Domain error-atomicity is helpful but does not prove CPI rollback. Claims similarly require token transfer and claim mutation to share a transaction. Do not expose unchecked arbitrary CPI instructions to the room PDA.
