# FLINCH decisions

## D018: Separate devnet identity and guarded deployment, 2026-09-11

The existing V2 deployment key is `8mGLM6MoGgJBfJXAESN5C5fmKXCwnfinDGXX8drPFEie`, but local source and accounts use `JDQgyFxwZJUpA31y2qhqhGgwfm5k7zANYUY1ctkqPB9y`. Preserve the running sandbox. A `devnet` build feature selects the deployment-key identity; the client selects the matching generated IDL, instruction owner, PDAs, sessions, receipt decoder and return proof. Unsupported program identities reject. The ABI generator checks that only identity-dependent metadata differs.

Use a dedicated deployer/upgrade authority, persistent buffer, keeper payer and four test wallets stored outside the workspace. Default CLI wallets and workspace-wide deployment are not the release path. Deployment is explicit, devnet-genesis checked, serialized and verified against a staged binary. Funding and test commands require their own execution flags and retain uncertain submissions.

Use the already funded Raydium pool `GoZmddUBTdiyRoGZSfxwX8p5ZNoVhDo42YN996JdDwoi`; no new pool or liquidity is authorized by this preparation. The September 10 upstream upgrade was reviewed separately from the old local pin and its downloaded binary passed runtime/CPI tests. Source-to-bytecode equivalence remains unverified. A failed program hash, pool check, fresh quote or confirmed return must stop the relevant operation.

The keeper can discover rooms only within an explicit pool/validator scope. It restores pending room journals even when discovery would exclude their now-terminal ledgers, reports capacity and keeps known-room recovery independent of discovery errors. This is bounded demo operation, not an unbounded public indexing service.

No public transaction was sent during preparation. Funding, actual deployment, hosted tests, extension-wallet proof and security release gates remain open. See DEVNET and TESTING.

## D017: Real-sales migration, 2026-09-05

The user requested implementation after selecting MagicBlock live gameplay, Solana custody, Circle devnet USDC, and Raydium devnet CPMM. This explicitly replaces the prior no-DEX architecture. The old specification and its reasons remain in [legacy/DECISIONS.md](legacy/DECISIONS.md).

Reason: returning WSOL does not exit SOL exposure. SELL must mean an executed exchange, not an oracle valuation or a renamed token transfer.

Supersedes old D002, D004–D006, D009, D011–D014 and their related tests. Preserve four players, public state, sessions limited to SELL, contextual oracle, no protocol rake, and devnet-only scope. Do not copy code from the V7 project.

## Chosen experimental defaults

| Decision | Default |
| --- | --- |
| Seats | Four, fixed wallet membership after funding |
| Stake | Initial UI preset 1,000,000 WSOL base units, or 0.001 SOL |
| Program stake range | 1,000,000–10,000,000 WSOL base units |
| Duration | 90 seconds from stored base Clock start |
| Cohorts | Two-second windows anchored to start |
| Game penalty | 25 bps of each seller's current WSOL entitlement |
| Penalty recipient | All holders outside the complete seller batch |
| Fill | One exact-input aggregate Raydium swap per batch |
| Quote protection | Positive per-seller minimum USDC output, bound to the intent |
| UI slippage default | 100 bps from fresh executable pool quote, shown separately from penalty |
| Execution window | Before cohort close plus 15 seconds |
| Recovery cutoff | Round end plus 30 seconds, enforced on base |
| Retry limit | At most three accepted intent attempts per seat; one successful sale |
| Natural outcome | One remaining holder keeps current WSOL entitlement |
| Deadline outcome | Multiple remaining holders keep WSOL; no forced loser |
| All holders sell together | No holder penalty; all exit at the batch fill |

The penalty, duration, and slippage settings are experimental demo parameters, not economically validated or production recommendations. Network and DEX fees remain separate from the zero protocol rake. Measure cost and behavior before changing these defaults.

## Architecture decisions

- Base Ledger is authoritative for every entitlement and receipt. Only Control moves between Solana and the ER.
- Freeze and undelegate Control for each economic batch. Settle or expire it on base, update Control from Ledger, then redelegate. Do not accept a keeper-supplied success flag or read a stale base receipt clone to release a pending ER batch.
- Serialize batches inside each room. Distinct rooms have separate custody and state; the shared Raydium pool and transaction fee payer can still contend.
- Keep eSPL, VRF, PER, Jupiter, and Magic Actions out of the replacement critical path. Do not remove their legacy code until the new runtime slice passes.
- Use one allowlisted Raydium pool per room, immutable after the first deposit. No arbitrary route instructions or keeper-selected destinations.
- No dual-runtime economic writes. Claim transfers and ledger mutations share one base transaction.

## Stop conditions

Do not silently replace real swaps with oracle-priced payouts if the integration fails. If a funded Circle-USDC pool, program-owned CPI, control handoff, or recovery cannot be demonstrated, stop that milestone and report evidence. Finish local code without publishing or spending funds; external setup requires separate authorization.

No architecture choice above implies deployed bytecode matches the inspected Raydium source. Verify program data and CPI compatibility in the integration gate.
