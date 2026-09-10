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

The enabled Railway demo receives only the dedicated keeper key through a sealed variable. The upgrade authority remains local. The hosted process validates payer identity, materializes an owner-only temporary file and cleans it up at shutdown; web receives neither this secret nor database credentials. PostgreSQL's restricted application role stores public operations. A dedicated connection lease serializes hosted workers during replacement, with abort on connection loss. This is an operational guard for cooperating instances, not a replacement for onchain authorization or replay checks. The separate test role and database are required for integration tests.

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

## Devnet preparation checks, 2026-09-11

`bun audit --json` was rerun and still reports the same six package families. No vulnerabilities are claimed remediated. The installed bigint native binding still fails to load; the observed runtime uses the JS implementation. SPL Token's buffer-layout wrapper passes fixed-width decoded integer fields into bigint-buffer. Anchor's TOML parser is in the local workspace loader, not FLINCH's account/transaction decoding path. These are scoped reachability observations, not an exemption or a promise that a rebuilt deployment has identical dependency reachability.

The isolated production trace lists Next's compiled image-size copy; that is not proof that the separately reported Metro dependency is used or that Next's compiled parser is safe. No untrusted image-upload route was added. Advisory remediation and release-bundle review remain open; production release is not approved by the devnet preparation.

Dedicated private keys use owner-only files outside the repository. Key reads reject symlinks, non-private permissions, malformed keys and mismatched identities. Deployment uses an exclusive journal, an immutable staged binary and explicit program, fee-payer, buffer and upgrade-authority keys. Resume accepts only the expected upgradeable-loader buffer shape/authority and accounts for its already-funded rent. Signed test submissions are recorded before network send; a lost response cannot trigger a second submission under the same operation name. Tests cover these negative paths without public transactions.

The source selected-pattern scan passed. An additional exact-key scan of 143 compiled production JS/JSON/HTML/map files found none of the eight prepared deployment/test key JSON arrays. This does not scan every encoding or certify dependency/build-cache/validator evidence. Only public result files may be attached to a submission; never attach the private deployment directory or a validator ledger.
