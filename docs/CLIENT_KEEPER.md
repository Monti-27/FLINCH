# Client and keeper contract

## Scope

One shared, browser-compatible client owns generated-IDL instruction builders, account decoding, exact base-unit values, network validation and placement checks. The keeper consumes that client; it never imports fixtures, controls player keys, changes minima or computes settlement payouts.

There is no message broker or global writable onchain room registry. The runtime supports explicit rooms and bounded discovery scoped to one pool and validator, with at most four concurrent room jobs. Local execution uses a file journal; Railway uses PostgreSQL for durable operation history and a separate singleton lease. Neither store controls balances. Existing Rust economics and program authorization remain authoritative. See RAILWAY for the enabled hosted deployment and tested handover.

## Modules

- `packages/client`: generated protocol interface, addresses, normalized accounts, instructions, routing, transactions and commitment observation.
- `apps/keeper`: pure decision function, one-room reconciler, bounded scheduler, local durable operation store and standalone CLI/runtime.
- `tests/client` and `tests/keeper`: wrong-account/route/network cases, state-machine boundaries, cancellation, unknown submission and restart behavior.
- `tests/stack`: uses the shared code against real local base/ER runtimes. Test-only placement and liquidity never enter the production package.

## Observation and submission

Read base Ledger, Control and Clock together at confirmed commitment. Decode only expected owners/discriminators/versions/PDAs. Normalize integer values to bigint. Fetch delegated Control from the router-returned FQDN after checking original owner and intended validator; verify the actual ER identity and current Control revision. Re-resolve placement each lifecycle iteration. No regional fallback.

The base read and delegated read are not one atomic cross-runtime snapshot. Mismatches mean wait/re-read, not permission to advance. Delegation Program ownership observed on ER during handoff means placement is pending, never permission to write. Unknown owners still reject. At recovery cutoff, base recovery is chosen before any ER lookup or pending ER status request. Control decoding is explicitly not required for cancelled, terminal or recovery-eligible rooms. A router outage or damaged Control must not prevent recovery.

Hosted placement includes the router's actual delegation slot. The pinned local SDK parser exposes only validator/status, so local resolvers instead report the slot at which that record was observed. The client refreshes base at that observation floor, confirms continuing delegation, and compares ER economics with both base snapshots. Never substitute an RPC response's context slot for a delegation timestamp.

Build with the destination runtime's blockhash. Signers may sign, but may not alter the compiled message. Record the operation identity and signed transaction's public signature before submission; never persist signed bytes or private keys. RPC acceptance is not confirmation. Confirmed instruction success is not the same as a confirmed swap or claim effect.

Transaction preparation fixes compute settings before preview and signing. Missing settings receive a zero micro-lamport unit price and 200,000 compute units per application instruction, capped at 1,400,000. Existing explicit settings are preserved; duplicate settings, invalid limits and deprecated unit requests reject. Zero priority fee is the current local/devnet test default, not a public-network inclusion guarantee. No fee is silently increased after approval. Legacy messages use the legacy compiler so reconstructing the same transaction preserves its account ordering. Both message formats retain exact-byte integrity checks after preview and after signing, and the 1,232-byte check runs before prompting the wallet. Mismatch errors identify changed categories without exposing transaction bytes or keys. See TESTING for the Phantom-compatible regression and remaining real-extension verification.

An uncertain submission stays pending. Reconcile its signature and current accounts before any new trade. Do not turn a timeout or expired blockhash into a claim of failure. The first keeper version pauses unknown operations rather than silently re-signing them. Current base state can supersede an old operation without claiming its signature succeeded. At the disjoint batch expiry boundary, an uncertain execute may be superseded only by expiry; at the hard cutoff, independent base recovery may supersede stalled work. Neither path trades tokens. Confirmed base signatures establish a minimum slot for subsequent account reads. ER slots are never compared to base slots.

Freeze requires separate base return evidence. The client searches up to 16 recent Control signatures at or before its base snapshot, fetches confirmed successful transactions, and decodes their inner instructions using the generated FLINCH IDL. It requires `processUndelegation` targeting the exact writable Control. Returned ownership, Frozen phase and current Ledger snapshot must also match. This works after restart or another keeper's handoff without depending on the original ER scheduling signature. Missing/pruned history pauses execution until proof becomes available or recovery is due. The older explicit stack harness retains its independent SDK 0.17.0 scheduling-log observer. Receipts and Ledger determine sale outcomes; a return callback does not prove a swap.

## Durable operation storage

The file store keeps each room's public operation history in an owner-only JSON file. Updates write a fresh file, sync it, rename atomically, then sync the directory. Signature, action, runtime, room, revision, genesis, observed slot and blockhash identify the operation; status transitions retain earlier records. Signatures decode to exactly 64 bytes and revisions are bounded u64 values. No signing keys, signed transaction bytes, credential-bearing URLs or unknown fields are accepted. History is capped at 2,048 transitions and reads at 2 MiB; a full or invalid journal fails closed before submission.

Use one store instance and one worker instance per journal directory. Writes serialize within that instance. The standalone runtime adds an exclusive owner-only `keeper.lock` to reject a second cooperating process, but the store itself is not a distributed lock or a multi-process database. Graceful shutdown drains in-flight work and releases the lock; an unclean exit requires operator verification before removing the exact stale lock. A restarted process may reopen the same directory only after the old process stops. Independent workers require independent journals; onchain authorization, revisions and receipt creation prevent duplicate economic effects, but do not promise zero duplicate fees. The local two-process test now pairs distinct signed settlements for two batches and proves one successful swap per receipt, failed losing transactions with no token changes, and both journals reconciling. It does not prove all race schedules or hosted behavior; see TESTING.

The standalone runner has separate read-only `inspect` and explicitly enabled `run --execute` modes. Configuration pins genesis, explicit rooms, a separately identified fee payer and bounded concurrency. Owner-only signing files stay outside the repository. Local placement uses the shared SDK-based `LocalPlacementResolver`; devnet uses the hosted router with no regional override. See [KEEPER_OPERATIONS.md](KEEPER_OPERATIONS.md) for configuration, status semantics, shutdown and limits.

## Current implementation and next work

The shared client and explicit-room keeper library are implemented. Local stack runs exercise session SELL, repeated Control returns, actual Raydium swaps, expiry/retry, four claims and keeper reconstruction between submissions and observations. They use synthetic liquidity and a test-only resolver backed by local delegation records and actual ER identity. They do not prove hosted router behavior.

One earlier local run rejected its second execute preflight with `DomainRejected: seller has no remaining position`. Later normal and expiry runs passed, but the rejection's cause has not been established. Keep the failed run and expanded account observations; do not label this integration stable or production-ready until reproduced and explained.

The quote adapter and browser UI are implemented. `quotes` computes exact-input pool estimates and per-seat cohort ranges. Quoted-intent helpers recheck venue, room revision, placement, cohort, minima and time before signing/submission. `accounts/receipts` validates bounded confirmed receipts and reconciles their sums against Ledger totals. Browser polling is sequential and cancels stale results. The hosted keeper discovers allowed rooms directly onchain; its only HTTP interface is health, not a signing or custodial API. Read QUOTES and FRONTEND before extending.

## Safety and verification

Configuration is localnet or devnet only and pins an expected base genesis hash. Hosted ER URLs must use HTTPS and MagicBlock's hostname boundary, with no credentials, queries or redirects. Local endpoints are accepted only through explicit localnet configuration. Sessions remain limited to SELL; the keeper signer pays only its own transaction fees.

Test protocol boundaries and recoverability before adding UI polish. Local tests do not replace the required hosted router, session-revocation, oracle, pool-liquidity and ten-round devnet gates. No public deployment or funding is authorized by this implementation.
