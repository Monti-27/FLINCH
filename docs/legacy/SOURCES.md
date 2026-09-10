# FLINCH research sources

Historical token-exit design, superseded on 2026-09-05. See the current documents in docs/. Retained to explain the unmigrated Anchor program; not the current build specification.

## Research snapshot

Research was consolidated on 2026-09-04. Primary sources were favored: the MagicBlock announcement, official documentation, official repositories, published package registries, and official examples. Commit hashes below make mutable source evidence reproducible.

## Product brief

- [MagicBlock Blitz V8 announcement and idea list](https://x.com/magicblock/status/2095527524474466434?s=20) — source for the hackathon context and original PvP stonk-battle direction.

The product wording in this repository is an implementation interpretation of that idea. The exact penalty schedule, player count, timing, cohort size, timeout, and terminal behavior are FLINCH decisions, not claims copied from the announcement.

## MagicBlock documentation

Documentation repository snapshot: [`3660d4ad50cd3251cec860898311b08a339b7b17`](https://github.com/magicblock-labs/docs/tree/3660d4ad50cd3251cec860898311b08a339b7b17)

- [Ephemeral Rollups introduction](https://docs.magicblock.gg/pages/ephemeral-rollups-ers/introduction/ephemeral-rollup)
- [Transaction lifecycle](https://docs.magicblock.gg/pages/ephemeral-rollups-ers/introduction/transactions)
- [Delegation guide](https://docs.magicblock.gg/pages/ephemeral-rollups-ers/how-to-guide/delegation)
- [Router `getDelegationStatus`](https://docs.magicblock.gg/pages/ephemeral-rollups-ers/api-reference/er/getDelegationStatus)
- [Local development](https://docs.magicblock.gg/pages/ephemeral-rollups-ers/how-to-guide/local-development)
- [Session Keys introduction](https://docs.magicblock.gg/pages/tools/session-keys/introduction)
- [Session Keys lifecycle](https://docs.magicblock.gg/pages/tools/session-keys/how-do-session-keys-work)
- [Session Keys security](https://docs.magicblock.gg/pages/tools/session-keys/security)
- [Pricing Oracle](https://docs.magicblock.gg/pages/tools/oracle/introduction)
- [VRF introduction](https://docs.magicblock.gg/pages/verifiable-randomness-functions-vrfs/introduction)
- [VRF best practices](https://docs.magicblock.gg/pages/verifiable-randomness-functions-vrfs/how-to-guide/best-practices)
- [VRF security](https://docs.magicblock.gg/pages/verifiable-randomness-functions-vrfs/introduction/security)
- [Security and audits](https://docs.magicblock.gg/pages/overview/additional-information/security-and-audits)
- [MagicBlock service status API](https://status.magicblock.app/api/services)

## Official source repositories

### Engine examples

Snapshot: [`e137826af4969d538ef10d8f672a8d77deb6e194`](https://github.com/magicblock-labs/magicblock-engine-examples/tree/e137826af4969d538ef10d8f672a8d77deb6e194)

- [Binary prediction Anchor example](https://github.com/magicblock-labs/magicblock-engine-examples/tree/e137826af4969d538ef10d8f672a8d77deb6e194/binary-prediction/anchor) — closest complete composition of ER, eSPL, Session Keys, and Pricing Oracle.
- [SPL token Anchor example](https://github.com/magicblock-labs/magicblock-engine-examples/tree/e137826af4969d538ef10d8f672a8d77deb6e194/spl-tokens/anchor) — token delegation, ER transfer, undelegation, and withdrawal lifecycle.
- [Roll Dice Anchor example](https://github.com/magicblock-labs/magicblock-engine-examples/tree/e137826af4969d538ef10d8f672a8d77deb6e194/roll-dice/anchor) — scoped VRF request/callback pattern.

The binary-prediction example manually constructs some eSPL instruction data. It is design evidence, not code to copy. FLINCH uses current public SDK/API exports.

### Ephemeral Rollups SDK

Snapshot: [`47607bee41ac69a781d4a0be309c4ef5951bbbbb`](https://github.com/magicblock-labs/ephemeral-rollups-sdk/tree/47607bee41ac69a781d4a0be309c4ef5951bbbbb)

- [Rust crate](https://crates.io/crates/ephemeral-rollups-sdk) — registry reported `0.17.0` on 2026-09-04.
- [TypeScript package](https://www.npmjs.com/package/@magicblock-labs/ephemeral-rollups-sdk) — registry reported `0.17.0` on 2026-09-04.
- [Ephemeral Rollups Kit](https://www.npmjs.com/package/@magicblock-labs/ephemeral-rollups-kit) — registry reported `0.17.0` on 2026-09-04.

### Ephemeral SPL Token

Snapshot: [`7288a12befccc5541f3411b03699ba0f57e6c078`](https://github.com/magicblock-labs/ephemeral-spl-token/tree/7288a12befccc5541f3411b03699ba0f57e6c078)

- [Repository](https://github.com/magicblock-labs/ephemeral-spl-token)
- [`ephemeral-spl-api` source](https://github.com/magicblock-labs/ephemeral-spl-token/tree/7288a12befccc5541f3411b03699ba0f57e6c078/e-token-api) — package version `0.0.0`, not published on crates.io; consume as a pinned git dependency if required.
- [eSPL program implementation](https://github.com/magicblock-labs/ephemeral-spl-token/tree/7288a12befccc5541f3411b03699ba0f57e6c078/e-token)

Observed program ID in the researched source: `SPLxh1LVZzEkX99H6rqYizhytLWPZVV296zyYDPagv2`. Prefer the current SDK/API constant during implementation.

### Pricing Oracle

Snapshot: [`c6d08ac317706c0943e9b6304b915cd1064bbea3`](https://github.com/magicblock-labs/real-time-pricing-oracle/tree/c6d08ac317706c0943e9b6304b915cd1064bbea3)

- [Repository](https://github.com/magicblock-labs/real-time-pricing-oracle)

Observed program ID in the researched source: `PriCems5tHihc6UDXDjzjeawomAwBduWMGAi8ZUjppd`. The actual devnet SOL/USD account, feed ID, exponent, and update cadence must be rechecked before deployment.

### Session Keys and VRF

- [Session Keys repository](https://github.com/magicblock-labs/session-keys) — crates.io reported `session-keys` `3.1.1` on 2026-09-04.
- [GUM SDK](https://www.npmjs.com/package/@magicblock-labs/gum-sdk) — npm reported `3.0.10` on 2026-09-04.
- [Solana VRF repository](https://github.com/magicblock-labs/solana-vrf)

Use scoped VRF APIs re-exported by the chosen ER SDK version. Do not add a second VRF crate without confirming the selected SDK requires it.

## Solana dependencies

- [Anchor](https://www.anchor-lang.com/) — npm `@coral-xyz/anchor` reported `0.32.1` on 2026-09-04; the official example's Rust program uses Anchor `1.0.2`.
- [Solana web3.js](https://www.npmjs.com/package/@solana/web3.js) — npm reported `1.98.4` on 2026-09-04.
- [SPL Token JavaScript](https://www.npmjs.com/package/@solana/spl-token) — npm reported `0.4.15` on 2026-09-04.
- [Wrapped SOL guide](https://solana.com/docs/tokens/basics/sync-native) — reference for wrapping native SOL into the native mint token account.

## Security and product reasoning

- [Smart Contract Security Field Guide: frontrunning](https://scsfg.io/hackers/frontrunning/) — supports avoiding raw first-transaction ordering for economically meaningful game actions.
- [CFTC and SEC investor alert on binary options](https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/fraudadv_binaryoptions.html) — reinforces avoiding binary-option or investment-return claims. FLINCH remains a devnet game and requires separate legal review before any real-value operation.

## Evidence limits

- Registry versions are current only as of 2026-09-04.
- Source commits are snapshots, not guarantees of hosted service behavior.
- The MagicBlock post is the product prompt, not a technical specification.
- Public docs and examples use different package versions; the compatibility spike is mandatory.
- No live FLINCH program, devnet deployment, transaction, or end-to-end result exists yet.
- No claim in these planning files should be presented as implementation evidence.

## Refresh checklist

Before implementation or deployment:

1. fetch current package metadata;
2. compare latest upstream commits and breaking changes;
3. verify program IDs and devnet feed accounts;
4. query the MagicBlock service status API;
5. run the compatibility spike;
6. replace planning placeholders with exact tested versions and addresses;
7. record the refresh date and evidence.
