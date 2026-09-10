# FLINCH execution plan

## Objective and implementation order

Deliver one complete four-player devnet game: base WSOL funding, session-authorized MagicBlock play, actual Raydium test-USDC exits, holder rewards, and independently recoverable claims. Build in five gated milestones. Test each increment before advancing. This is an execution plan, not a statement that its unimplemented integrations work.

The user approved starting local implementation. Do not initialize Git, publish, deploy, request faucet tokens, or fund a pool without separate authorization. No mainnet operations. Preserve all legacy source until replacement tests pass; do not carry two active protocols into the eventual deployable program.

## Reading and source verification

Before each layer, follow README → handoff → decisions → game rules → architecture → MagicBlock, then the layer specification. The [source ledger](SOURCES.md) records exact revisions and package candidates.

| Layer | Required upstream reading | What must be verified |
| --- | --- | --- |
| Control handoff | MagicBlock transaction lifecycle, delegation, commit builder, local development, router API; matching SDK implementation | Ownership restoration, seed binding, stale clone retirement, repeated redelegation, commit evidence |
| Sessions | SessionTokenV2 implementation and security guide | Program/wallet/signer scope, application action limits, expiry, revocation propagation |
| Custody | Solana PDA, SPL transfer_checked, associated accounts, WSOL sync-native; Anchor constraints and CPI | Native mint behavior, signer seeds, exact owner/mint/destination, integer amount handling |
| Swaps | Raydium CPMM swap_base_input, initialize, fee accounting, pool state, official SDK create/swap examples | Exact-input instruction and account layout, devnet deployment, actual reserve deltas, minimum output, all fee fields |
| Prices | MagicBlock Pricing Oracle program and feed guide | Identity, exponent, posting slot, upstream publish time, stale behavior |
| Client/UI | Anchor generated IDL client, MagicBlock SDK, Wallet Standard, Next.js client/server boundaries | No duplicated instruction encoding or secrets in browser bundles |

Do not install latest packages blindly. Keep existing Rust pins; recheck registries and service status immediately before new dependency installation. Lock exact TypeScript versions after the compatibility smoke test. Raydium's alpha SDK belongs only in a narrow infrastructure module, not the domain or UI.

## Module boundaries

```text
crates/flinch-domain/src/
  allocation.rs          exact integer distribution
  economics.rs           penalty and net-input calculation
  cohort.rs              Clock-derived windows
  batch.rs               immutable economic batch
  ledger/                settlement, expiry, recovery, claims
programs/flinch-v2/src/  staged replacement; legacy stays separate
  state/                 bounded Anchor account layouts
  instructions/          validation and one transition per module
  integrations/          MagicBlock, SPL custody, Raydium CPI
packages/client/src/    IDL decoding, instruction builders, routing, observations
packages/test-kit/      local fixtures, ordinary bot wallets, evidence assertions
apps/keeper/src/        discovery, bounded execution workers, reconciliation
apps/web/src/features/  lobby, match, claims, proof
tests/local/            LiteSVM SBF account/CPI tests
tests/stack/            real local base + ER integration
tests/devnet/           live services and repeatable rounds
```

Create modules when they contain a tested responsibility, not empty speculative scaffolding. Rust domain must be no_std, allocation-free, framework-free, and usable by the eventual Anchor program. SDKs never enter it. No business logic in UI components or keeper jobs. Generate client types from the IDL; retain decimal amounts as bigint/base-unit strings until formatting. Use the existing web3.js family for SDK compatibility, not a simultaneous Solana Kit migration.

New Rust files, including tests, have a 300-line ceiling enforced by a local check. Prefer small functions and explicit types; no code comments, unsafe code, floating-point financial math, generic service frameworks, or unbounded collections in accounts. Do not rewrite the old 741-line engine just to satisfy a length metric; retire it with its replacement.

## Milestone 1 — Decisions and deterministic protocol

Implement now: archive old specifications, record the replacement decision, and add the independent domain crate. Model exact penalties, equal holder rewards, proportional USDC output, immutable round/revision-bound batches, expiry, terminal outcomes, and one-shot claims. A frozen batch is a value, not proof of authorization; only the future onchain Control account can authorize execution.

Test every seller subset, small/large stakes, every successful batch partition, rounding ties, wrong round/revision, wrong observed input, individual minimum violations, replay, deadlines, late execution after recovery, and two-asset conservation. Rejected calls must leave the value unchanged. Preserve passing legacy tests. No new third-party Rust dependencies for this milestone.

Exit: domain tests, formatting, strict lint, no-comment/file-size checks pass; no claim of runtime security or token movement.

## Milestone 2 — Custody and standalone swap proof

Replace Anchor entrypoints with base Ledger/Control accounts and SPL vaults using the established Anchor 1.0.2 family. Add a validated serialization-neutral domain snapshot/restore boundary before mapping stored Anchor account fields; the current private in-memory Ledger is not yet a deserializer. Freeze two permitted mints, pool, stake, and timing. Implement wallet funding, duplicate-seat rejection, full-room start, funding timeout, wallet-only claims, and base recovery. Bind instruction parameters to stored accounts, never public domain constructors alone.

Build one typed Raydium exact-input CPI adapter from the reviewed IDL/source. Do not forward arbitrary instruction data or allow arbitrary program IDs. Validate pool owner/config/mints/vaults/authority/token programs and recorded pool address. Observe input/output vault balances around CPI, reload account state, verify exact input and per-seller output allocation, then persist ledger and receipt. All effects share one transaction. Keep fees visible; do not equate zero game rake with free DEX execution.

Use a local validator with the reviewed Raydium program and explicit local mint/liquidity fixtures. Implement fixture-only pool creation outside production program code. Devnet target is Circle USDC and one funded Raydium pool; read configuration/reserves through RPC, not a mainnet-only discovery API. Funding and pool creation are a separate authorized setup action. Do not claim the local mint is Circle USDC.

Exit: real local deposit → PDA-signed swap → claim; failed minimum-output transaction rolls everything back; wrong accounts and duplicate claims reject. SBF and IDL generation pass. Remove legacy instruction paths only after replacement regression coverage exists.

## Milestone 3 — MagicBlock control lifecycle

Implement the [handoff contract](ARCHITECTURE.md): base creates Control from Ledger revision, delegates it, router resolves placement, valid wallet/session queues intent, permissionless close freezes the complete cohort, commit-and-undelegate returns Control, base settles or expires, then updates/redelegates it if live. No economic state is delegated and no keeper-reported receipt is accepted.

The session permits only queue_sell, on one room/seat, with nonce and attempt limits. Match the wallet-authorized session signer stored in the room. Keep claims and session changes wallet-only. Gate base execution on the canonical returned Control account, current revision, immutable batch, expected ownership, and time. No normal base entrypoint can fabricate a Frozen Control.

Use pinned mb-stack only after checking current binary flags. Run two consecutive settle/redelegate cycles to prove base updates replace old ER clones. Test a delayed old commitment, lost keeper, invalid session, revoked session, mismatched FQDN, fill/expiry race, and ER-unavailable base recovery. Withdrawals must not need Control after recovery.

Exit: one full local cross-runtime token flow and repeat handoff pass. Measure acknowledgement and settlement separately. Recheck the actual hosted router/session/claim path on devnet only after deployment authorization. If handoff latency is unacceptable for 90 seconds, report measurements rather than inventing instant fills or silently changing the rules.

## Milestone 4 — Client, keeper, and playable room

Add a Bun workspace with one generated-IDL client shared by Next.js, a Node-compatible keeper, tests, and bots. Use React, TypeScript strict mode, Wallet Standard via wallet adapter, Vitest/Testing Library, and Playwright. Pin versions only when adding this layer. No database or message broker initially: chain accounts are the source of truth, keeper state is reconstructible.

The client owns base/router/ER separation, placement verification, matching blockhashes, decimal serialization, and bounded confirmation. Keeper is permissionless and pays only its own fees: discover due rooms, close/execute/expire/redelegate, retry from observed state. Maximum four active room jobs per worker initially, one job per room, bounded backoff 250ms–4s; duplicate workers must be safe through onchain guards. Never retry an unknown-status swap blindly.

Build lobby → live room → claims/proof. Show queued, returning to Solana, executing swap, sold/claimable, claimed, expired, and recovery states. Display exact penalty and executable minimum separately from SOL/USD reference. Session secrets remain memory-only; reload reconstructs state and uses wallet signing if the session is gone. Disable SELL during a handoff without pausing the displayed match timer.

Exit: one human plus three ordinary bots completes a full game; reconnect at every boundary; type check, unit tests, production build, and Playwright pass. Keep public discovery, chat, tournaments, and elaborate replay out of this slice.

## Milestone 5 — Devnet evidence and release hardening

After explicit external-setup approval, verify program IDs, upgrade authorities, fee configuration, network genesis, mint decimals, and liquidity. Use tiny fixed stakes and a funded Circle-USDC pool. Choose a public ER validator from measured health/latency, then verify every placement through the router; never hardcode its endpoint into delegated-account flows.

Run at least ten sequential completed rounds covering sequential sells, multi-seller batches, all-sell, nobody-sells standoff, failed/expired fill, reconnect, session expiry, stale reference oracle, keeper restart, and base recovery. Retain a repeatable evidence bundle with network, versions, program IDs, round, revision, signatures, observations, and before/after balances. Mark unexercised failure injections explicitly, never substitute a claimed live outage.

Test concurrent independent rooms and shared-pool contention. Report p50/p95 acknowledgement, commit, fill, and claim times; no throughput claim without measured load. Scan secrets, keypair-shaped arrays, generated files, dependencies, unsafe account substitutions, and frontend bundles. Use a fresh browser for two demo rehearsals.

Exit: every claim has evidence and no manual ledger repair. Mainnet remains blocked on independent security/economic/legal review, liquidity/MEV analysis, load testing, key governance, and incident response. Devnet success is not a production certification.

## Milestone status

Milestones 1–2 are implemented and locally verified in the staged V2 program: 35 domain tests, 21 runtime tests, three harness tests, 18 legacy regressions and one V2 program-ID test pass. SBF, IDL, TypeScript, formatting and strict workspace lint pass. Legacy retirement remains a separate migration step.

Milestone 3's local happy path and expiry/retry path pass on real base/ER runtimes, including repeated redelegation, session SELL, actual Raydium CPI and four claims. Local independent-keeper settlement races, warm-session revocation with wallet fallback, base recovery through a keeper ER transport outage, and actual delayed commitment returns across expiry/recovery now have specific proof. Hosted routing/revocation, old-generation replay after subsequent delegation and broader timing/multi-room/soak cases remain unverified. Evidence and toolchain limitations are in [TESTING.md](TESTING.md).

Milestone 4's shared client and explicit-room keeper library are implemented with 16 client and 18 keeper tests, plus real local client/keeper normal and expiry/retry runs. Generated-IDL drift, exact units, wrong network/placement, durable submission identity, restarts, recovery independence and bounded concurrency have tests. See [CLIENT_KEEPER.md](CLIENT_KEEPER.md) for ownership and storage boundaries.

Milestone 4 now includes executable Raydium quotes, a modular Next.js frontend, Wallet Standard signing, memory-only sessions, claims, receipt proof and local browser round coverage. Type/unit/build checks pass. Quote-backed normal and expiry/retry stack rounds pass. The browser uses a test Wallet Standard adapter to sign real local transactions; actual extension compatibility and reload at every handoff remain unverified. The browser UI defaults to read-only.

Milestone 4 is still not complete. The standalone keeper and explicitly enabled interactive local sandbox are implemented, including four-browser gameplay and room invites. Ordinary extension compatibility, persistent-world resume, comprehensive browser/fault coverage and dependency-advisory remediation remain. An earlier intermittent second-batch preflight rejection is still unexplained despite subsequent passing runs; reproduce it before claiming integration stability. Milestone 5 has not started. No external deployment or funding is authorized. Keep [LLM_HANDOFF.md](LLM_HANDOFF.md) current after each tested slice.
