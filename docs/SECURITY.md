# FLINCH security and recovery

## Trust boundaries

Solana executes custody and settlement. MagicBlock executes authenticated intents before their base commitment. Router discovery is not authorization. Session validity is not token authority. Raydium is an external swap venue, not the game ledger. Oracle samples are context, not fills. Browser and keeper output are untrusted observations until confirmed against accounts.

Devnet tokens have no value, but every accounting invariant still applies. The source of a devnet program is not automatically the bytecode deployed at its address. Record program data/upgrade authority and verify the CPI path before release.

## Required negative cases

- Substituted room, Control, mint, vault, receipt, pool, config, token program or destination.
- Forged or expired session, wrong bound signer, duplicate nonce, fourth attempt, session used for a wallet-only claim.
- Base-side attempt to fabricate a Frozen Control, execution before ownership return, stale snapshot, replayed revision, old ER clone after redelegation.
- Partial swap, insufficient reserves, wrong input delta, low allocated output for any seller, arithmetic overflow, duplicate claim, token-account aliasing.
- Late commit/fill after expiry or recovery; race between execution, expiry and recovery.
- Unsolicited vault donations; never require exact equality with ledger liabilities or assign donations as rewards.
- Shared pool changes and price impact; never silently loosen a player's minimum to make the demo succeed.

## Liveness and recovery

One batch is pending per room. No live host cancellation. Anyone can progress time-based settlement or expiry; only wallet owners claim. Keeper has no custody key or privileged winner-selection path.

Hard cutoff is stored on base. Once elapsed, anyone can terminate the economic ledger without Control or the DEX. Subsequent fills reject before CPI. Wallets claim current WSOL and already-earned USDC. In-flight ER intents may never become sales; present that honestly. Solana unavailability may still delay recovery.

If a swap response is lost, read signature status, Receipt and Ledger before rebuilding. Retry the same logical action only if state proves no effect; expired blockhash is not proof that an earlier transaction failed. Final UI claim status requires confirmed transaction metadata/destination delta, not a keeper message.

## Operational boundaries

Keep session secrets in browser memory and deployer/keeper secrets outside the repository. Do not log signed payloads, private keys, seed phrases, bearer tokens, or credential-bearing URLs. Test wallets and funding scripts stay in test-kit, never frontend bundles. Logs may contain public signatures, account keys, revisions and base-unit amounts.

A controlled upgrade authority remains a real trust risk even without economic admin instructions. Publish it after authorized deployment; do not claim immutability. Never delete a live account/receipt merely to unblock a test.

Mainnet requires independent program/economic review, liquidity and MEV analysis, legal review, upgrade governance, monitoring, incident response, and load tests. No V8 milestone substitutes for these.

## Dependency advisory gate, 2026-09-06

`bun audit --json` completed with findings, not a clean result. No broad transitive overrides were applied without a compatibility review. Installed paths were checked with `bun why`.

| Package | Reported issue | Installed path |
| --- | --- | --- |
| bigint-buffer 1.1.5 | High: native buffer overflow, GHSA-3gc7-fjrx-p6mg | SPL Token → buffer-layout-utils |
| image-size 1.2.1 | High: malformed image parser denial of service, GHSA-w3rx-r6r6-pgpr / GHSA-5p2g-fcmc-qvqq | Wallet adapter mobile peer → React Native/Metro |
| toml 3.0.0 | High: recursion/prototype pollution, GHSA-82x6-q7mm-w9cf / GHSA-v5mp-jgw5-2x6j | Anchor and GUM's Anchor dependency |
| stream-json 1.9.1 | Moderate: nested input denial of service, GHSA-528h-pc64-c93x | web3.js → jayson |
| uuid 8.3.2 | Moderate: caller-buffer bounds, GHSA-w5hq-g745-h8pq | web3.js → jayson |
| elliptic 6.6.1 | Low: cryptographic implementation risk, GHSA-848j-6mx2-7j84 | ER SDK → dcap-qvl |

These are package advisory matches, not demonstrated FLINCH exploit paths. Browser bundle reachability, native-binding activation, untrusted-input exposure and safe compatible upgrades still require review. The local native bigint binding was unavailable and tests used the JS implementation, but that observation is not a remediation or future deployment guarantee. Release remains blocked on this work and the other security gates.

Source/generated-artifact scanning excludes dependency caches, build output and local validator evidence directories intentionally. Scan release bundles and deployment material separately; a passing selected-pattern scan does not certify those excluded surfaces.
