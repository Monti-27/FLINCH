# Devnet operation

## Public Railway gameplay, 2026-09-11

Use [the public arena](https://flinch.up.railway.app/play). Transactions and the dedicated hosted keeper are enabled. Web → private backend → PostgreSQL health checks pass. The laptop's Devnet keeper was drained and stopped with no unresolved submissions; no local process is required to progress public games. Never run the local signing keeper or the local-keeper soak command concurrently with hosted execution.

`devnet-browser-J3INdz/result.json` verifies four public-browser deposits, three actual Raydium swaps and four exact claims, with both room vaults empty. It also covers direct-wallet and session SELL, reload, cancelled create/claim requests, explicit quote expiry, four base session revocations and a withdrawal during a browser-only ER outage. The room is `4ptoEDeLaqRAXCcX4apwZCMwgeSyo6Hej3MWxREw5xcC`. `hosted-proof.json` verifies ten keeper transactions and three base returns from the hosted PostgreSQL journal; `hosted-restart.json` verifies its twenty transitions remained identical after a new container took over. See RAILWAY for exact deployment IDs and secret boundaries.

The ten-round soak below remains valid public-Devnet evidence, but it used the earlier local keeper. The additional Railway browser run is separate hosted proof. All browser tests use synthetic Wallet Standard adapters, not installed wallet extensions. No mainnet certification or exhaustive fault coverage is claimed.

For the demo, use four distinct disposable Solana wallets on Devnet, funded with about 0.1 test SOL each for rent, sessions, stakes and transaction fees. Create a room, share the invite, join from all four wallets, then hold or sell and claim. No USDC faucet is needed. Claims return WSOL or USDC; WSOL stays wrapped. Slow wallet approvals can expire the two-second quote and require an explicit refresh; an authorized session avoids repeated approval prompts.

No additional deployment funding is needed. The dedicated keeper has 0.185398360 devnet SOL and the deployment wallet has 5.877644920, observed after the hosted round at slot 496387728. These balances are time-specific. The upgrade-authority key was not uploaded to Railway.

## Historical read-only website verification, 2026-09-11

Read-only checks around 04:17–04:22 IST confirmed the public program still has deployment slot `496357443`, ProgramData and SHA-256 listed below, on the expected Devnet genesis. The existing Raydium pool had nonzero WSOL/USDC reserves. The router returned the expected Asia validator and `https://devnet-as.magicblock.app/`; the status API reported public Asia/Europe/USA ER and router operational. TEE router was down and is not used. No new room or transaction was submitted.

The hosted frontend at `https://flinch-game.up.railway.app` and keeper health at `https://flinch-keeper.up.railway.app/health` are now reachable, superseding the older no-hosting notes below. Both report Devnet, but frontend transactions are disabled and the keeper reports `disabled`, with its database connected. This is a hosted read-only preview, not enabled public multiplayer. `artifacts/runs/railway-smoke-1789080508603/result.json` verifies landing/arena navigation, disabled creation, real market reference data, wallet picker, rules, responsive layouts and reload without signing. See RAILWAY for the separate hosting work.

The screenshot's port-3400 build remains Localnet and must not be relabeled Devnet. Local source now removes stale claims that the program is undeployed, labels the hero/footer from their configured network, and preserves test-token warnings. Those changes are verified on the separate port3418 production preview; this pass did not publish or enable anything. Existing ten-round evidence was inspected, not rerun. Extension-wallet, hosted full-play and remaining session/fault/security gates remain separate.

## Public deployment, 2026-09-11

The user funded the dedicated deployment wallet with 10 devnet SOL and resumed deployment. V2 is now deployed and its onchain bytes exactly match the tested binary. Ten consecutive public devnet rounds passed: 20 actual Raydium swaps and 40 exact wallet claims. Evidence: `artifacts/runs/devnet-soak-OBKTH8/result.json`. A further four-wallet browser round passed three swaps and four claims in `artifacts/runs/devnet-browser-e54FJZ/result.json`. Ordinary extension wallets and the remaining fault/security gates are not certified by these results.

Deployment signature: `2jM6cwWoM6ApC3PinfP7ghC55SCekU5AYimTvKnoevHycBb4xHoZRwZMaVPQFicna24cNUH65MYqR9npbxXPZFYr`, slot `496357443`. ProgramData: `E5uQZ7VVjKcxUzbmUt8gXB4nQiMbzhUhUCA1uCyx7o4U`. The deployment transaction, code hash and upgrade authority are retained in `artifacts/runs/devnet-probe-1789078302287`. The deployer remains upgrade authority. No new pool, liquidity deposit, faucet request, mainnet transaction or remote hosting was performed.

The deployable binary is 613,664 bytes, SHA-256 `287c84d684a0d54ef5272364e18018d7e21f9fdd9c1a46fa59e02206d3510828`. Its generated devnet IDL matches the client ABI. The devnet feature changes program identity only; default local builds retain their existing ID and accounts. Never deploy the legacy `programs/flinch` or use an unqualified workspace-wide `anchor deploy`.

| Purpose | Public address |
| --- | --- |
| Fund this deployment wallet | `7SBUeGFvem7dDWq5Sbcq9pTcDrXc4KZa6TDEQjP8AmNy` |
| Deployed V2 program ID | `8mGLM6MoGgJBfJXAESN5C5fmKXCwnfinDGXX8drPFEie` |
| Separate keeper fee payer | `33sxC2jXiptFfxoGgP52qEjDvpdGksZPmN6ZHTBfYMJ8` |
| Persistent deployment buffer | `5nu1VEZBgmfC2v69yG1yZqZ8YNqeYz6LgfBumQjm5u6x` |
| Existing WSOL/USDC pool | `GoZmddUBTdiyRoGZSfxwX8p5ZNoVhDo42YN996JdDwoi` |

Private keys are owner-only files under `/Users/montisaini/.config/flinch/devnet`, outside the repository. Do not publish that directory, print its JSON keys, move the buffer key, or use the personal Solana CLI wallet. `identity.json` contains only public addresses. The deployment wallet also controls upgrades; the program is not immutable.

## Funding

The initial request was **8 devnet SOL**; the user supplied 10. Deployment cost 3.122345080 SOL including retained rent and fees. Initial keeper/player funding was 0.900000000 SOL; a subsequent 0.100000000 SOL host-wallet top-up came from the testing contingency. That transfer is confirmed as `4HrnA7piBuMyv1hG8FwFnV913KPbg12QTpvVEYQeXr6dYZW4ZbYWRMha1jr3xcbjqN3866QJ9F6B758fUjAGcPT4`, retained in `devnet-test-reserve-1AJbZJ`. After the successful browser round, the deployment wallet held **5.877644920 SOL** at base slot `496373376`; keeper reserve was 0.192947440 SOL. No further user funding is currently required. These are devnet test tokens, not mainnet assets. The original conservative headroom budget was:

| Budget | Devnet SOL |
| --- | ---: |
| Program account | 0.000833120 |
| Permanent program data | 3.118291960 |
| Temporary upload buffer | 3.118251320 |
| Estimated deployment fees | 0.007020000 |
| Keeper reserve | 0.300000000 |
| Four test wallets, 0.15 each | 0.600000000 |
| Contingency | 0.500000000 |
| Total before rounding | 7.644396400 |

The buffer amount is temporary headroom, not a second permanent program. Actual fees, account rent and pool liquidity must be rechecked before sending. Resume preflight validates the same buffer and subtracts its existing funded rent from the required wallet balance. Do not fund the program ID itself.

## Read-only preparation

Run commands from `/Users/montisaini/flinch`.

```sh
bun run devnet:prepare --directory /Users/montisaini/.config/flinch/devnet
bun run devnet:build /Users/montisaini/.config/flinch/devnet
bun run devnet:probe --directory /Users/montisaini/.config/flinch/devnet
```

Preparation reuses keys and rejects differing existing configuration. Builds write to the private `build` directory, leaving the local sandbox binary alone. Read-only probes enforce devnet genesis, program identity, exact ABI, loader/upgrade authority, reviewed Raydium bytecode, Session Keys and Delegation Program hashes, real pool layout/reserves, router selection and actual ER identity. Router account placement is still validated separately for each delegated Control during play.

The current Raydium devnet binary changed from the September 5 pin. Both artifacts are retained. `idls/raydium.devnet-provenance.json` records the new upstream review, hash and compatibility evidence. The new bytecode passes all 23 LiteSVM tests, including exact quote/CPI parity across both orientations and all creator-fee modes. A separate local stack using the actual FLINCH devnet-feature binary completed two real Control returns, two local Raydium swaps and four claims without Control injection. This is local proof with synthetic liquidity, not a public swap or proof that upstream source reproduces deployed bytecode.

The Session Keys and Delegation Program downloads used locally match their current public devnet bytecode hashes exactly. Service status is not proof of session propagation, live commitments or recovery latency.

## After funding and deployment approval

```sh
bun run devnet:deploy --directory /Users/montisaini/.config/flinch/devnet --execute-devnet
bun run devnet:probe --directory /Users/montisaini/.config/flinch/devnet
bun run devnet:fund --directory /Users/montisaini/.config/flinch/devnet --execute-devnet
```

Deployment locks its private journal, stages a hash-checked binary, uses explicit fee-payer/program/buffer/authority keys and verifies the landed binary afterward. It refuses an unexpected existing deployment rather than upgrading it. The private deployment log must be inspected before any retry. No CLI default can select mainnet or the legacy program.

Participant funding sends only the missing amounts to the prepared keeper and four test wallets. Its plan and signature persist before submission. An existing funding directory blocks another transfer after an uncertain response. Reconcile the signature and recipient balances; do not delete the journal to make a retry work. No tool requests faucet tokens.

## Ten-round test

Stop a manually running keeper first: the test acquires the same exclusive journal and runs the real discovery service itself.

```sh
bun run devnet:soak --directory /Users/montisaini/.config/flinch/devnet --execute-devnet
```

The runner passed ten consecutive public rounds in `devnet-soak-OBKTH8`. It creates four-wallet rooms with 0.001 SOL stakes, tests a session-authorized first sale and direct-wallet second cohort, requires two swaps and four exact claims per round, revokes the session and checks empty room vaults. It retains round plans, verified account-specific routing, signatures, transaction logs, receipts, keeper operations and wallet balances under `artifacts/runs/devnet-soak-*`.

The runner refreshes only preparations that have never reached submission. Quote expiry, cohort closure and pending placement remain enforced. Read-only transport failures receive bounded retries; a lost broadcast response is reconciled using the original recorded signature, never a newly signed send. Tests cover both the successful reconciliation and unknown-response stop paths. This does not change browser quote policy or onchain timing.

Quotes and minimum outputs are never loosened on expiry or low liquidity. Unknown writes stop the run and retain their signatures; there is no automatic re-signing. A failed run can leave a funded room or claimable entitlement. Inspect its round plan, resume the keeper for base recovery where needed and claim with the owning wallet before starting another run. `node tools/devnet/reclaim.ts --directory PRIVATE_PATH --room ROOM --evidence EXISTING_RUN --execute-devnet` cancels a still-funding prepared test room or claims an already-terminal one, checks wallet ownership and exact balance deltas, and revokes its sessions. It does not repeat unknown submissions or recover before the cutoff. A successful ten-round result still does not prove ordinary extension wallets or deliberately induced hosted outages.

Retained earlier stops: `devnet-soak-ozjAwH` completed one round before a pre-submission second-batch stop; its unfinished room subsequently recovered on base with the earlier sale intact and four exact claims. `devnet-soak-uY0iIx` completed one round before a later partial lobby stopped; that lobby was cancelled and both deposits refunded. Both rooms have empty vaults. Original generic errors did not retain enough detail to establish their exact cause. The successful later run explicitly records pre-submission cohort-closure refreshes; do not retroactively assign those diagnostics to the older failures.

## Keeper and browser

```sh
bun run keeper inspect --config /Users/montisaini/.config/flinch/devnet/keeper-config.json
bun run keeper run --config /Users/montisaini/.config/flinch/devnet/keeper-config.json --execute
bun run devnet:web --directory /Users/montisaini/.config/flinch/devnet --enable-transactions
```

The keeper discovers V2 rooms scoped to the configured pool and validator, including rooms made by ordinary browser wallets. It restores pending journals on restart, keeps servicing known rooms if discovery fails and reports the 128-room capacity limit. Base recovery remains independent of ER availability. The hosted handoff is now complete; these foreground signing commands are only for a separately coordinated return to local operation. Do not start them while Railway signs. The read-only `inspect` command remains safe. No machine startup service has been provisioned.

The frontend command creates a separate production snapshot under `artifacts/runs/devnet-web-*`. It does not restart port 3400, rebuild its `.next`, change the local genesis or edit local environment files. Transaction-enabled builds require verified deployment. Without `--enable-transactions`, the result is a read-only preview.

Start the returned release with `bun run devnet:web --serve /absolute/path/to/devnet-web-release` only when a local UI is useful. It serves `/play` on loopback port 3500. The earlier verified transaction-enabled release is `/Users/montisaini/flinch/artifacts/runs/devnet-web-a5gxPb`. The public HTTPS deployment is now enabled and is the demo entry point. Port 3400 belongs to the unrelated local sandbox and was not restarted during hosting activation. The local web command never changes Railway settings.

Browser verification used four separate synthetic Wallet Standard adapters signing real devnet transactions. It passed create/join, session SELL, direct-wallet SELL after reload, three swaps, four exact claims, final-holder termination, rejected create/claim approvals, quote expiry, base session revocation and a USDC claim while that browser's ER requests were blocked. Both room vaults ended empty. This is a client-side outage test, not a hosted ER outage. No private keys were embedded in the browser build.

Independent pool/placement reads and ER identity/Control reads now run concurrently. Identity is still checked before Control is interpreted, with all owner, revision, clock, quote and pre-submission checks retained. In the passing browser run, two preparations expired and were explicitly refreshed before any send. Session signing is the intended low-friction path; a slow wallet approval can still exceed the unchanged two-second quote window. Refresh never signs or lowers a minimum.

Connect a Wallet Standard-compatible Solana wallet with legacy transaction signing. The existing adapter discovers registered wallets; the configured RPC identifies devnet to mobile adapters. Trust Wallet, Phantom and Solflare extension behavior still need real-device verification. A synthetic Wallet Standard test is not evidence that a specific installed extension works.

Use four distinct wallets, select devnet in each wallet where supported, give each test SOL from the faucet, create a room and share its invite. No USDC faucet is necessary: successful sales receive actual devnet USDC from the existing pool. Claims return WSOL or USDC token accounts; WSOL stays wrapped. Never send mainnet assets. The chart is Coinbase reference data, not the pool execution price; the selected test pool currently has a very different exchange rate.

## Remaining release gates

- Hosted warm-session revocation propagation and expiry races. Fresh account-specific placement after redelegation is covered by the ten-round run.
- Deliberately delayed/failed-return and late-fill races. Actual public hard recovery and exact claims passed for the interrupted room; this was not an induced hosted committer outage.
- Real Trust Wallet and other extension rejection, reload, disconnect, network-selection and claim tests.
- Dependency advisory remediation/review from SECURITY; `bun audit` is not clean.
- Optional MagicBlock price-feed integration, if wanted separately. Its service status is not a verified feed. It is not used to price settlement.

The funded-wallet step enables further testing; it does not mean these gates are already satisfied.
