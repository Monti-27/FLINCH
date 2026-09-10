# MagicBlock and SDK integration

## Minimal product set

Public ER executes shared intents. Session Keys authorize only queue_sell. Pricing Oracle optionally supplies separately labeled SOL/USD reference samples. No eSPL, VRF, PER, Jupiter, recurring crank, or Magic Actions in the new critical path. Legacy program dependencies are preserved only until migration.

## Connections

- Base: `https://rpc.magicblock.app/devnet`; validate genesis/network before funding.
- Router: `https://devnet-router.magicblock.app/`.
- ER: use Control's router `getDelegationStatus` FQDN, never a hardcoded region.
- Verify base owner is Delegation Program while delegated, ER owner is FLINCH, intended validator matches, and expected revision is readable.
- On return, confirm the extracted base commitment signature and FLINCH ownership before settlement. Build every transaction with its target runtime's blockhash.
- The shared client locates a confirmed successful base `processUndelegation` callback for the exact writable Control using the generated IDL, independent of ER scheduling history. See [CLIENT_KEEPER.md](CLIENT_KEEPER.md) for proof and bounded-history requirements.
- After redelegation, invalidate cached placement and subscriptions; require the new base-authored revision on ER.

Keep `#[ephemeral]` before `#[program]`, use SDK delegation contexts and `MagicIntentBundleBuilder`, and import `FoldableIntentBuilder` at external call sites. Use no copied MagicBlock instruction bytes or invented PDA seeds.

## Compatibility checked 2026-09-05

| Dependency | Version | Status |
| --- | --- | --- |
| Rust Anchor / anchor-spl | 1.0.2 | V2 SBF/IDL and both local runtimes pass; macro crates pinned to match |
| Rust ER SDK | 0.17.0 | Existing exact pin; replacement needs only anchor feature |
| Rust Session Keys | 3.1.1 | Existing exact pin |
| TS ER SDK | 0.17.0 | Installed exact pin; delegation records and identity checks exercised locally |
| GUM SDK | 3.0.10 | Installed exact pin; SessionTokenV2 creation/revocation exercised |
| TS Anchor | 0.32.1 | Generated V2 IDL builders/decoders work locally |
| web3.js | 1.98.4 | Installed exact pin; real base and ER transactions |
| SPL Token JS | 0.4.15 | Installed exact pin; real local wrap/deposit/claim |
| LiteSVM | 0.8.0 | Compatible web3.js family; 21 SBF tests pass |
| Raydium SDK V2 | 0.2.63-alpha | Not installed; the tested narrow quote adapter uses the reviewed IDL and exact CPMM formulas |
| Local ephemeral-validator | 0.14.10 | Installed; repeated local control lifecycle and expiry/retry pass |

Existing rust-toolchain requests 1.89.0; RUSTUP_TOOLCHAIN overrides it to stable, observed as rustc/cargo 1.94.1. Anchor CLI is 0.32.1, build-side Solana CLI 2.3.0, Bun 1.3.14, Node 24.14.1. Host 1.89.0 remains unverified. SBF builds pass with platform-tools v1.53; the old build CLI emits standard-syscall warnings despite actual successful SBF execution. Passing stack runs use already-installed Agave 3.1.10 via process-local PATH, not a global upgrade. ER reports 0.14.10, source ee62453, Solana 4.0.0. Preserve these distinctions when reproducing.

No runtime dependency is needed for the new domain library. Keep exact crate pins and Cargo.lock. Before using Raydium CPI, verify its deployed program layout against the reviewed IDL, rather than importing an incompatible Anchor program crate wholesale.

The shared client keeps the same package family and does not import test fixtures. SDK `ConnectionMagicRouter.getDelegationStatus` exposes only a boolean in its declared response type and uses an unbounded global fetch internally in 0.17.0. The client uses a bounded JSON-RPC adapter for the documented FQDN/owner/authority/delegation-slot response. Hosted metadata and actual ER identity are both checked. Localnet requires an explicit resolver; it never defaults to the hosted devnet router.

`@types/bn.js` 5.2.0 is pinned explicitly so generated nested Anchor account fields retain types rather than silently becoming `any`. TypeScript 5.9.3 and Node types 24.10.1 are pinned. Packages were installed with lifecycle scripts disabled.

The local stack adapter uses legacy messages within the 1,232-byte limit. Early-genesis V0 messages passed preflight but were dropped during sanitization on the tested base versions; the precise cause is unresolved. It polls the upstream SDK 0.17.0 commitment-log format instead of its blocking confirmation helper, then independently checks all base transactions and restored Control. This fixed a measured second-cycle observation delay without changing game timing or settlement rules. Do not silently reuse this adapter across SDK versions.

ER Clock can be ahead of base Clock: two observed returns were one base second before cohort close. The executor waits for the base execution window and rejects expiry. ER acceptance/return never implies a successful sale.

## Sessions and time

SessionTokenV2 binds wallet, signer, target program and expiry; FLINCH additionally binds the session signer to the room, validates a strictly increasing nonce, a positive per-seat minimum output, holding status and at most three attempts. Sessions cannot fund, claim, update parameters, or invoke recovery as wallet authority. Claims remain available to the actual wallet.

Test revocation visibility on the selected ER. Never describe session revocation as immediate across runtimes without measured evidence. Keep secrets in memory only and allow direct wallet SELL if authorization is unavailable while the room is still accepting intents.

The local `test:stack:session` now proves revocation of an ER-warmed session: confirmed base removal, observed ER removal, matching authorization rejection in simulation and an actual failed transaction, then direct-wallet swaps and claims. The local ER can return a send error labeled simulation failure while exposing a failed signature; reconcile actual status. Revocation does not cancel previously accepted intents. Hosted propagation, expiry/revocation races and latency bounds remain unverified; see TESTING for exact evidence.

Use onchain Clock, not user timestamps. Max batch execution time is cohort close plus 15 seconds. At round end plus 30 seconds, base recovery must not require delegation restoration.

## Service and sponsorship checks

On 2026-09-05 the status API reported public Asia, Europe and USA ER/router/oracle services operational. TEE Asia router was down; PER is not used. This snapshot is not a future availability guarantee. Recheck immediately before live tests.

The status API was rechecked during the client/keeper work on 2026-09-06 IST (2026-09-05 UTC), with the same public-devnet operational/TEE-router-down result. This read-only check is not a FLINCH devnet integration test.

Rechecked again at 2026-09-05T19:06:42Z before adding the frontend dependencies: public-devnet Asia/Europe/USA ER, router and pricing-oracle services reported operational; TEE Asia router reported down. No public FLINCH transaction was submitted.

One commit-and-undelegate per economic batch; redelegation refreshes the documented allowance. Cap attempts and measure sponsorship/rent/fees. Do not add a fee vault speculatively. Test delayed/exhausted sponsorship and preserve base recovery.

## Oracle policy

Expected account, owner, feed ID, exponent, positive value, nonzero posting slot, and upstream publish age must validate before any verified mark. Initial maximum age: 30 seconds, subject to actual devnet cadence measurement. Stale/missing data never controls Raydium output or blocks claims.

## Validation gate

Native tests alone do not validate the cross-runtime contract. Local stack runs now prove Control handoff, repeated settle/redelegate cycles, expiry/retry, two independent keepers racing settlement and warm-session revocation with wallet fallback. Targeted committer transport faults also prove actual late Control returns after expiry and recovery: expired fills reject, expiry consumes the revision without a penalty, and terminal recovery remains authoritative while existing proceeds and holder balances stay claimable.

Local routing checks do not prove hosted `getDelegationStatus` behavior. Devnet router/session-revocation/reference-feed/swap/claim checks, old-generation replay after a subsequent delegation and broader timing/multi-room/soak cases remain outstanding. The transport proxy does not alter Clock, Control, signatures or upstream responses except its explicit targeted 503 fault. See [TESTING.md](TESTING.md) for evidence, preflight-versus-landed rejection distinctions and local retry observations.
