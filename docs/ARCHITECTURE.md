# FLINCH architecture

## Decision

Use a public MagicBlock ER for visible, session-authorized sell intents. Keep all tokens and the economic ledger on Solana. Return the control account to base for each batch, perform the actual swap and accounting atomically, and redelegate only the updated control state.

Base-only execution would be simpler for four individual sells. ER is selected for the shared, low-latency game interaction and hackathon scope, not to claim faster DEX finality. The handoff is an explicit latency tradeoff and a milestone-3 validation gate.

## Account and authority model

All application accounts are public and created on base. Host pays initial account rent; players supply only their displayed stake plus disclosed wallet/ATA/session fees. Keeper pays its own transaction fees. No account closure in the initial demo; retain receipts for inspection.

| Account | Owner and authority | Delegated | Role and lifecycle |
| --- | --- | --- | --- |
| Ledger PDA | FLINCH; instruction rules | Never | Immutable room configuration, wallet seats, WSOL/USDC entitlements, revision, terminal state, claim totals |
| Control PDA | FLINCH originally; Delegation Program while on base during delegation | Yes, one room validator | Snapshot of Ledger configuration/revision, authenticated intents and nonces, one immutable frozen batch; returned for every economic transition |
| Room WSOL ATA | SPL Token; Ledger PDA authority | Never | Deposit custody and Raydium input; excludes unrelated donations from accounting |
| Room USDC ATA | SPL Token; Ledger PDA authority | Never | Actual swap proceeds and player claims |
| Receipt PDA per revision | FLINCH; settlement/expiry instruction | Never | Immutable result, amounts, seller mask, execution time; retained |
| Player ATAs | SPL Token; player's wallet | Never | Wallet-funded sources and fixed wallet-owned claim destinations |
| SessionTokenV2 | Session Keys; wallet authority | No FLINCH delegation | Readable on selected ER; expiry/revocation and room-bound signer checked on every SELL |
| Raydium pool/config/vaults | Raydium and SPL Token; external program authorities | Never | Allowlisted base venue; no game authority over liquidity |
| SOL/USD feed | MagicBlock oracle provider | Service managed | Read-only optional context; never authority for token exchange |
| Delegation metadata/buffer/record | MagicBlock programs | Protocol managed | Derived through SDK, bound to Control seeds and validator |

Use new versioned application seeds: Ledger `[b"ledger-v2", host, nonce_le]`, Control `[b"control-v2", ledger]`, Receipt `[b"receipt-v2", ledger, revision_le]`. Do not reinterpret old Round account bytes or reuse old account layouts. External seeds come from pinned upstream builders.

## Routing and authority

| Flow | Signer and writes | Runtime | Success and failure |
| --- | --- | --- | --- |
| Create/fund | Host/player wallet; Ledger and base ATAs | Base | Exact deposit and unique seat recorded atomically; retry from observed state |
| Start/delegate | Permissionless payer when full; Ledger and Control | Base | Start once; Control snapshot matches Ledger; discover placement before play |
| Queue SELL | Stored wallet or valid bound session; Control only | Resolved ER | One increasing nonce and minimum output stored; no token credit |
| Freeze/return | Permissionless payer; Control and SDK commit accounts | Resolved ER | Full closed cohort frozen and commit-and-undelegate requested; no settlement claim |
| Execute batch | Permissionless payer; returned Control, Ledger, Receipt, room/pool token accounts | Base | Exact observed input, output, per-player minimum checks and accounting commit together |
| Expire batch | Permissionless payer; returned Control, Ledger, Receipt | Base | Deadline passed; revision consumed with no game penalty or token credit |
| Redelegate | Permissionless payer; returned Control | Base | Copy authoritative Ledger revision/holdings and reset pending batch before delegation |
| Recover | Permissionless payer; Ledger only | Base | At hard cutoff close economic ledger; no dependency on Control or ER |
| Claim | Stored player wallet; Ledger and correct ATAs | Base | Transfer and one-shot claim marker atomically; observe confirmed destination delta |

## Handoff contract

1. Base creates Control from fully funded Ledger, copying fixed wallet membership, room identity, economic parameters, start/end, balances, and revision. Delegation is pinned to the chosen validator.
2. ER validates the actual wallet/session and app nonce before storing an intent. At cohort close, freeze the complete seller bitmap and immutable minimum outputs. Reject any later intent or edit to that batch.
3. Freeze and commit-and-undelegate are one ER instruction. Prove its runtime context through the matching SDK/Magic Program path; normal base instructions must not be able to fabricate Frozen Control. This requires negative runtime tests, not an offchain endpoint check.
4. Base execution requires Control restored to FLINCH ownership, correct version/PDA/ledger association, Frozen phase, matching revision and entitlement snapshot, correct window, and an unconsumed Receipt address. A mere ER signature or ordinary commit without ownership return is insufficient.
5. Execute only the bound Raydium pool. Reload token accounts and check deltas after CPI. Persist swap economics, terminal state, Receipt, and Control result together, or roll all financial effects back.
6. Expiry races execution on the same base Ledger/Control accounts and disjoint time conditions. One consumes the revision. A failed transaction leaves the batch retryable until expiry; it never charges a game penalty.
7. Before a new batch, base synchronizes Control from Ledger and delegates it anew. A fresh ER must reflect that revision before any action is shown as available. This avoids asynchronous receipt-clone reconciliation. Verify stale clone retirement through at least two live cycles.
8. At hard cutoff the base Ledger can close without Control. Every future fill checks terminal state and time before any CPI. A late returning Control cannot reopen it. Claims are based only on the base ledger.

## Bounded state and scaling

Use four fixed seats and one pending batch per room. Domain values have no allocator or network calls. Keep the base ledger authoritative; clients and workers rebuild from accounts and immutable receipts.

No global writable game registry or shared game vault. Room workers can run independently; the shared Raydium pool and payer remain real transaction contention points. Start with four worker jobs and measure before raising concurrency. Larger player counts, pool sharding, databases, event queues, and multi-region services are not V8 requirements.

## Failure and recovery

The 30-second grace is an onchain safety boundary, not a guarantee the ER recovers in that time. Funds can become claimable without ER availability because custody never leaves base. Uncommitted/expired intents produce no sale, and the UI must report that explicitly.

No keeper/admin can redirect claims, waive user minima, choose arbitrary swap routes, or select a winner. DEX outages preserve WSOL until expiry/recovery. Oracle outages affect only reference display. Solana outages can delay all base actions; no system can promise availability during that failure.

See [SECURITY.md](SECURITY.md) for trust limits and [TESTING.md](TESTING.md) for the claims-to-evidence gates.

## Application packages

The generated-IDL client in `packages/client` owns exact units, account validation, instruction builders, base/router/ER separation, submission identity and base-return observation. `apps/keeper` consumes that interface through pure decisions, reconciliation, durable public operation history and bounded explicit-room scheduling. Neither package imports local fixtures or moves economic rules out of the Rust program.

At batch expiry, an uncertain fill can only advance to non-trading expiry; at the hard cutoff, recovery does not read ER status or deserialize Control. Independent workers still require onchain replay protection; a local journal is not a distributed lock. See [CLIENT_KEEPER.md](CLIENT_KEEPER.md) for the implemented boundary and remaining quote/UI work.
