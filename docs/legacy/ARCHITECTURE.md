# FLINCH architecture

Historical token-exit design, superseded on 2026-09-05. See the current documents in docs/. Retained to explain the unmigrated Anchor program; not the current build specification.

## Decision

Use one public MagicBlock Ephemeral Rollup for the round state and all active eSPL-backed token balances, keep the actual backing tokens in the eSPL Global Vault on Solana, resolve simultaneous and terminal cohorts with delegated VRF, then undelegate and withdraw each player's final balance.

## System boundaries

```text
Wallet / browser
    |
    | create room, fund, delegate, session approval
    v
Solana base layer
    |-- Round PDA before and after play
    |-- WSOL ATA balances
    |-- eSPL Global Vault with real backing tokens
    |-- SessionTokenV2 accounts
    |
    | delegate Round and eATAs to one validator
    v
MagicBlock ER
    |-- Round state and timer
    |-- Round and player token-account representations
    |-- delegated eSPL balance records
    |-- SELL intents and penalty accounting
    |-- VRF request and callback
    |-- oracle snapshots
    |
    | commit and undelegate
    v
Solana base layer
    |-- durable result
    |-- withdrawable player token balances
    v
Optional wallet-controlled unwrap or external swap
```

## Components

| Component | Responsibility | Trust boundary |
| --- | --- | --- |
| Next.js web app | room UX, wallet/session flow, subscriptions, replay | never authoritative for order, balances, or result |
| Solana wallet adapter | user approvals and ownership | wallet signs funding, session creation, recovery, withdrawal |
| FLINCH Anchor program | validates players, ranks, penalties, VRF, payouts, lifecycle | authoritative game rules |
| Magic Router | routes by writable account placement | route must be verified, not assumed |
| Ephemeral Rollup | executes live state transitions | fast execution is not base settlement |
| eSPL program | Global Vault backing and eATA lifecycle | token balance and delegation lifecycle are separate from game authorization |
| Session Keys program | temporary gameplay authority | session scope does not grant token authority |
| Pricing Oracle | authenticated SOL/USD snapshots | price validity is checked independently; payout does not depend on availability |
| VRF oracle | random order for tied sell cohorts | callback is asynchronous and must be authenticated and idempotent |
| Optional relay/indexer | submits permissionless resolution and indexes replay | cannot choose winners or move funds outside program rules |

## Accounts

| Account | Owner | Created | Delegated | Mutable runtime | Terminal policy |
| --- | --- | --- | --- | --- | --- |
| `Round` PDA | FLINCH program | base | yes | ER | commit and undelegate after all payouts |
| round authority | PDA signer derived from Round | derivation only | no | signs CPI on ER | no account required unless rent/funding needs it |
| Round WSOL ATA | SPL Token program; authority is Round PDA | base | represented on ER | ER during play | drain; optionally close after proof retention |
| Round eATA record | eSPL program; authority is Round PDA | base | yes | ER | undelegate after pool is zero |
| player WSOL ATA ×4 | SPL Token program; authority is player wallet | base | represented on ER | ER during play, base after return | destination after withdrawal; optional close unwraps WSOL |
| player eATA record ×4 | eSPL program; authority is player wallet | base | yes | ER | undelegate and withdraw after entitlement transfer |
| Global Vault | eSPL program | base | no | base custody | remains shared infrastructure |
| Global Vault ATA | SPL Token program | base | no | base custody | holds backing WSOL |
| SessionTokenV2 ×4 | Session Keys program | base | no | read on ER | expires after the round; user can revoke |
| SOL/USD oracle | oracle program | service managed | special feed routing | read on ER | external dependency |
| delegation buffer/record/metadata | MagicBlock programs | base | n/a | protocol lifecycle | reconciled on undelegation |

## Authority model

- Host may configure and start only before `Live`.
- A player wallet signs funding, join, Session Key creation, and withdrawal.
- A valid session may call only `queue_sell` for its wallet and round before expiry.
- The Round PDA signs transfers from its ER token-account representation.
- Cohort resolution and terminal settlement are permissionless after their time conditions.
- Only the authenticated VRF callback may write random tie order.
- No admin can reorder sells, change penalty rates, replace the mint, or seize tokens after funding starts.

## Transaction routing

| Flow | Signers | Writable accounts | Destination | Success condition |
| --- | --- | --- | --- | --- |
| Create round | host | Round | base | account exists with immutable parameters |
| Initialize/delegate pool custody | host/payer | Round ATA, Round eATA, vault, delegation accounts | base | router reports expected validator and ER token balance |
| Deposit/delegate player balance | player | player ATA, vault, player eATA, delegation accounts | base | ER token account shows exact available stake |
| Join | player | Round, player ER token account, Round ER token account | resolved ER | stake moved to pool and seat recorded atomically |
| Create session | player | SessionTokenV2 | base | scope and expiry match the round |
| Start | host or permissionless when full | Round | ER | `started_at` recorded once |
| Queue sell | wallet or valid session | Round | ER | pending bit stored once in current cohort |
| Resolve one seller | permissionless | Round | ER | rank and entitlement recorded |
| Request tie VRF | permissionless | Round and VRF request accounts | ER | request identity and pending state stored |
| VRF callback | VRF identity | Round | ER | tied ranks assigned exactly once |
| Transfer seller payout | permissionless | Round, Round ER token account, player ER token account | same ER | exact entitlement transferred once |
| Finalize holder | permissionless | Round, Round ER token account, holder ER token account | same ER | remaining balance transferred and pool reaches zero |
| Undelegate player eATA | player or supported recovery actor | player eATA | ER | base commitment confirmed |
| Withdraw player token | player | eATA, vault ATA, player ATA | base | base ATA receives exact balance |
| Commit/undelegate Round | permissionless authorized path | Round | ER | base owner restored with terminal state |

## Lifecycle

### Room setup

1. Fetch the selected ER validator identity.
2. Create Round with fixed mint, validator, stake, duration, capacity, and penalty schedule.
3. Initialize the Round ATA, Round eATA record, and WSOL Global Vault using the eSPL API.
4. Delegate Round and Round eATA to the same validator.
5. Confirm router placement before accepting players.

### Join

1. Wrap devnet SOL to WSOL if needed.
2. Deposit and delegate the player's eATA pinned to the room validator.
3. Verify Round, Round eATA, and player eATA resolve to the same ER FQDN.
4. Submit `join` on that ER; transfer the exact stake between the ER token-account representations.
5. Create a SessionTokenV2 scoped to `queue_sell`, the player wallet, program, round, and expiry.

### Live match

1. Store `started_at` and opening oracle snapshot.
2. Subscribe to Round and price updates.
3. Queue SELL intents by two-second cohort.
4. Resolve single intents directly.
5. Resolve tied intents with VRF or the timeout rule.
6. Make each seller entitlement transferable exactly once.
7. End early when one holder remains; at 90 seconds, resolve all remaining holders as a terminal VRF cohort.

### Settlement

1. Resolve every pending cohort.
2. Transfer each unclaimed seller entitlement if necessary.
3. If the timer ended with multiple holders, resolve the terminal VRF cohort or timeout fallback.
4. Transfer the exact remaining pool balance to the final holder.
5. Store final price snapshot and terminal audit fields.
6. Undelegate user eATAs and confirm base commitments.
7. Withdraw balances from the Global Vault into base ATAs.
8. Commit and undelegate Round.
9. Close the drained pool custody only after recovery tests pass; retaining it for the demo is acceptable.

## Consistency and idempotency

- Every instruction checks the expected Round status.
- `queue_sell` requires a new player nonce and rejects sold or pending players.
- `resolve_cohort` records the cohort as resolved before any later cohort can progress.
- VRF request identity, seed, pending cohort, and fulfillment flag are stored in Round.
- Payout transfer marks entitlement claimed in the same transaction.
- Settlement may be called repeatedly and becomes a no-op after `Settled`.
- Withdrawal reads current ownership and balance; it never assumes propagation finished.

## Observability

Persist outside the chain account:

- base funding and delegation signatures
- router FQDN and validator identity
- every ER SELL signature and cohort index
- VRF request and callback signatures
- opening, sell, and closing oracle publish times
- payout transfer signatures
- commit signatures and base confirmations
- withdrawal signatures and final ATA balances

The UI state vocabulary is fixed: `preparing`, `live`, `sell pending`, `sold on ER`, `resolving tie`, `settling`, `returning to Solana`, `withdrawable`, `withdrawn`, and `recovery required`.

## Deployment topology

- Frontend: static-capable Next.js deployment.
- Program: one Anchor program deployed to MagicBlock-compatible Solana devnet.
- Backend: optional lightweight indexer/keeper; never authoritative.
- Data: chain subscriptions first, small local cache for chart and replay presentation.
- Secrets: deployment keypairs and RPC credentials remain outside the repository.

## Architecture limits

- The actual in-game asset is WSOL; BONK/WIF rooms require a separate mainnet and liquidity decision.
- SELL transfers token units out of the game pool. Stable-value conversion is an optional later wallet workflow.
- The price feed is evidence and atmosphere, not a payout oracle.
- A seller's base withdrawal is asynchronous relative to the ER action.
- A full mainnet version needs legal, custody, liquidity, and operational review.
