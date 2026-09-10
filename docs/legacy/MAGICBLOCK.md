# FLINCH MagicBlock integration

Historical token-exit design, superseded on 2026-09-05. See the current documents in docs/. Retained to explain the unmigrated Anchor program; not the current build specification.

## Integration decision

FLINCH uses a public Ephemeral Rollup for the 90-second match, Ephemeral SPL Token for real WSOL custody and ER-local balance movement, Session Keys for the single in-match SELL action, the Pricing Oracle for verified SOL/USD context, and VRF only when a sell cohort needs fair ordering.

Solana remains the durable custody and recovery layer. The ER is the live execution layer. Those are different product states and must be shown separately.

## Why each product exists

| Product | Required job | What it does not prove |
| --- | --- | --- |
| Public ER | low-latency shared round mutations | base settlement or token withdrawal |
| eSPL | put WSOL-backed balances in the ER and return them to base | game authorization or stablecoin conversion |
| Session Keys | remove wallet prompts during the live round | token ownership or unlimited spending authority |
| Pricing Oracle | supply authenticated SOL/USD context | player authorization or payout value |
| VRF | order tied sell intents without operator discretion | request completion before the callback lands |

The V8 critical path deliberately excludes PER, Private Payments, Cranks, and Magic Actions. The room is public, no recurring scheduler is necessary, and adding post-commit effects or private transfer queues would add failure states without improving the core demo.

## Selected Rust compatibility family

The repositories and registries were inspected on 2026-09-04. Current published versions and the closest official example do not use one uniform dependency set.

| Dependency | Current published version | Official binary-prediction example | Initial candidate |
| --- | ---: | ---: | ---: |
| Rust `ephemeral-rollups-sdk` | `0.17.0` | `0.16.2` | test `0.17.0` first |
| npm `@magicblock-labs/ephemeral-rollups-sdk` | `0.17.0` | `0.14.3` | test `0.17.0` first |
| npm `@magicblock-labs/ephemeral-rollups-kit` | `0.17.0` | not used | only if its provider hooks materially help |
| Rust `session-keys` | `3.1.1` | `3.1.1` | `3.1.1` |
| npm `@magicblock-labs/gum-sdk` | `3.0.10` | `^3.0.10` | `3.0.10` |
| Rust Anchor | verify during spike | `1.0.2` | `1.0.2` if SDK `0.17.0` compiles with it |
| npm `@coral-xyz/anchor` | `0.32.1` | `0.32.1` | `0.32.1` |
| npm `@solana/web3.js` | `1.98.4` | transitive/example-specific | `1.98.4` |
| npm `@solana/spl-token` | `0.4.15` | `^0.4.14` | `0.4.15` |

The selected program dependency set is:

- Anchor `1.0.2`;
- `ephemeral-rollups-sdk` `0.17.0` with `anchor` and `vrf`;
- `session-keys` `3.1.1`;
- `ephemeral-spl-api` at `7288a12befccc5541f3411b03699ba0f57e6c078`;
- Solana platform-tools `v1.53` or newer for the current Rust 2024 dependency graph.

The ER SDK `spl` feature is not used by the program. In `0.17.0` it activates encryption and host-side dependencies that fail for the SBF target. FLINCH keeps ER/VRF support in that SDK and consumes the official pinned eSPL API directly for typed discriminators, arguments, and PDA derivation.

The remaining compatibility gate must execute:

1. a pool-authority eSPL lifecycle using the pinned upstream API crate;
2. a user `delegateSpl`, ER SPL transfer, undelegation, and withdrawal;
3. a live scoped ER VRF request and authenticated callback;
4. a live `SessionTokenV2` SELL authorization.

Native tests, strict linting, SBF compilation, and IDL generation pass. Runtime compatibility remains unverified until the local lifecycle succeeds.

## eSPL integration model

FLINCH needs a program-owned pool. The client-only lifecycle is not sufficient for creating and funding a pool whose authority is a Round PDA, so the design follows the official binary-prediction composition:

- use the direct eSPL program surface for pool bootstrap and PDA-authorized custody;
- use current TypeScript SDK helpers for player deposit, delegation, undelegation, and withdrawal;
- use standard SPL Token CPI against the ER token-account representations during gameplay;
- never copy instruction discriminator bytes, PDA seeds, or account order from an example.

`ephemeral-spl-api` is not published on crates.io. If the program needs direct eSPL CPI, depend on the official repository at a reviewed revision, initially:

```toml
ephemeral-spl-api = { git = "https://github.com/magicblock-labs/ephemeral-spl-token", rev = "7288a12befccc5541f3411b03699ba0f57e6c078", package = "ephemeral-spl-api" }
```

The dependency compiles natively and for SBF. FLINCH's adapter builds CPI instructions from the crate's public `ESplInstruction`, `DelegateArgs`, `EphemeralAta`, and `GlobalVault` types. It does not copy discriminator bytes or derive eSPL PDAs locally.

### Token objects that must not be conflated

| Object | Address/owner | Meaning |
| --- | --- | --- |
| wallet WSOL ATA | canonical ATA; SPL Token | base-layer source and final destination |
| Round WSOL ATA | canonical ATA for Round PDA; SPL Token | program-controlled token account represented in the ER |
| player eATA record | `[owner, mint]` under eSPL | delegated balance/lifecycle record |
| Round eATA record | `[Round PDA, mint]` under eSPL | delegated pool balance/lifecycle record |
| Global Vault | `[mint]` under eSPL | per-mint custody authority |
| Global Vault ATA | canonical ATA for Global Vault | actual locked WSOL backing all eSPL balances |

The game program transfers between the ER representations of the canonical token accounts with SPL Token CPI. The eATA records and Global Vault implement the cross-runtime custody lifecycle. Documentation and telemetry must identify which object a balance came from.

## Connection model

| Connection | Default devnet endpoint | Purpose |
| --- | --- | --- |
| Base RPC | `https://rpc.magicblock.app/devnet` | create, fund, delegate, create sessions, withdraw |
| Router | `https://devnet-router.magicblock.app/` | `getDelegationStatus` and ER FQDN discovery |
| ER RPC | router-returned `fqdn` | match actions, VRF request/callback, commits, undelegation |
| ER WebSocket | derived from the verified FQDN | subscriptions for round and balances |

No production code may assume `devnet-as.magicblock.app`. The room chooses a validator identity before delegation and pins every mutable Round/eSPL account to it. After every delegation, the client verifies:

1. router reports `isDelegated: true`;
2. router returns the same FQDN for the Round and every participating eATA;
3. base owner is the Delegation Program;
4. ER owner is the original program;
5. the ER account is readable before the room advances.

Any mismatch leaves the room in `Preparing` and blocks the start transaction.

## End-to-end lifecycle

### Base preparation

1. Resolve an intended devnet ER endpoint and fetch its validator identity with `getIdentity`.
2. Create the Round PDA and immutable parameters on base.
3. Create the Round WSOL ATA, Round eATA record, Global Vault, and Global Vault ATA if needed.
4. Deposit the pool bootstrap balance if the selected eSPL path requires it and delegate the Round eATA to the chosen validator.
5. Delegate the Round PDA with exactly matching seeds and validator configuration.
6. For each player, wrap SOL, call `delegateSpl` for the exact stake plus any required buffer, and pin the same validator.
7. Verify co-location through the router before joining.

### ER play

1. `join` transfers exactly one stake from the player's ER token account to the Round ER token account.
2. The wallet creates a `SessionTokenV2`; only `queue_sell` accepts its session signer.
3. `start_round` records the Clock timestamp and a valid opening price if available.
4. `queue_sell` records a single intent in the current cohort without trusting client time.
5. `resolve_cohort` assigns one seller directly or requests scoped VRF for a tie.
6. The authenticated callback assigns ranks and transfers seller payouts exactly once.
7. `resolve_tie_timeout` provides a conservation-safe fallback after ten seconds.
8. `finalize_round` transfers the exact remaining pool balance to the holder.

### Return to Solana

1. The UI shows `Settled on ER`, not `Withdrawable`.
2. Undelegate one player eATA per transaction on the ER.
3. Extract the base commitment signature from the ER transaction and confirm it on base.
4. Verify the eATA is again owned by the eSPL program on base.
5. Call the selected `withdrawSpl` builder on base.
6. Verify the destination WSOL ATA delta.
7. Optionally close the WSOL ATA to unwrap after the user explicitly chooses it.
8. Commit and undelegate the Round only after the terminal receipt is complete.

Default shuttle withdrawal and legacy explicit undelegate/withdraw are separate builders. The compatibility spike must choose one and test it end to end; code must not infer a stored mode from the earlier deposit call.

## Session Keys

The wallet remains the authority. A session key is a temporary signer accepted only for `queue_sell`.

Required checks on every session-authorized call:

- target program is FLINCH;
- wallet authority equals the player stored in the seat;
- session signer equals the transaction signer;
- token is not expired or revoked;
- Round matches the authorized application context;
- the player is still holding and has not used the action nonce.

No session token is accepted for join, start, resolve, payout, undelegate, withdrawal, recovery, or closing accounts. FLINCH does not need a token delegate for SELL because the player stake is already controlled by the Round PDA before the session begins.

## Pricing Oracle

The SOL/USD feed is contextual, not economic. Its failure cannot block payout or withdrawal.

For every accepted snapshot, validate:

- configured account address and provider;
- exact feed ID;
- expected exponent;
- nonzero posting slot;
- positive price;
- upstream publish time within the configured maximum age;
- checked conversion to the stored fixed-point representation.

Store raw price, exponent, upstream publish time, and local slot. If validation fails, emit a stale/unavailable marker and continue game resolution without writing an invented price.

## VRF

Use the SDK `vrf` feature and the scoped APIs. Apply `#[vrf]` to the request context and `#[vrf_callback]` to the callback context. An ER request must use `DEFAULT_EPHEMERAL_QUEUE` or the current equivalent exposed by the pinned SDK.

Persist:

- Round key;
- cohort index;
- monotonically increasing request nonce;
- seller bitmap;
- unresolved rank range;
- request timestamp;
- status: `None`, `Requested`, `Fulfilled`, or `TimedOut`.

The callback must match all persisted fields, accept each nonce once, and become harmless after timeout resolution. Derive the permutation with unbiased rejection sampling rather than modulo bias.

## Commit policy and quota

Normal ER transactions are currently free. Each delegated account receives ten ordinary sponsored commits by default. V8 uses one terminal commit per Round and one terminal return per player balance, so it should remain within the default model. Do not add a delegated fee payer or fee vault unless the compatibility test proves additional commits are required.

The maximum planned uncommitted interval is one match plus resolution, targeted below 180 seconds. A terminal Round is committed and undelegated after payouts. User eSPL balances follow their own eSPL undelegation and withdrawal lifecycle.

## Failure behavior

| Failure | Product response | Recovery |
| --- | --- | --- |
| router or ER unavailable before start | block new room start | retry discovery; never accept funds into an unrouteable room |
| one account placed on another validator | block join/start | undelegate and redelegate before gameplay |
| Session Key invalid | reject SELL | wallet may submit SELL directly or recreate session before expiry |
| oracle stale | mark price stale | continue gameplay and token settlement |
| VRF delayed | show tie pending | permissionless timeout resolution after ten seconds |
| duplicate VRF callback | no economic effect | reject consumed or mismatched nonce |
| commit delayed | show returning to Solana | poll router, base owner, and commitment signature |
| withdrawal fails | keep withdrawable state | rebuild from current base accounts and retry idempotently |

## Environment configuration

The implementation may define equivalent names, but the runtime separation must remain explicit:

```text
NEXT_PUBLIC_SOLANA_RPC_ENDPOINT
NEXT_PUBLIC_MAGICBLOCK_ROUTER_ENDPOINT
NEXT_PUBLIC_FLINCH_PROGRAM_ID
NEXT_PUBLIC_WS_ENDPOINT
NEXT_PUBLIC_SOL_USD_ORACLE_ACCOUNT
NEXT_PUBLIC_SOL_USD_FEED_ID
KEEPER_KEYPAIR_PATH
DEPLOYER_KEYPAIR_PATH
```

Never commit keypairs, session secrets, bearer tokens, or paid RPC credentials. Browser code must not receive keeper or deployer secrets.

## Implementation sources

The precise source ledger and pinned revisions are in [SOURCES.md](SOURCES.md). The closest official composition reference is MagicBlock's `binary-prediction/anchor` example, but it contains manually encoded eSPL instructions. FLINCH must use current SDK/API exports instead of copying those bytes.
