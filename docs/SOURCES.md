# FLINCH source ledger

## Verified 2026-09-05

- [Circle USDC addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses): Solana devnet mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`; read-only RPC confirmed initialized SPL mint with six decimals.
- [Circle faucet](https://faucet.circle.com): Solana devnet listed; faucet tokens have no financial value. No faucet request submitted.
- [Raydium CPMM source](https://github.com/raydium-io/raydium-cp-swap/tree/244e1241f3c8d90eb93f176dfbc35f2605ec5a5c): devnet program `DRaycpLY18LhpbydsBWbVJtxpNv9oXPgjRSfpF2bWpYb`; read-only RPC confirmed executable. This does not prove deployed-bytecode/source equivalence.
- [Raydium SDK examples](https://github.com/raydium-io/raydium-sdk-V2-demo/tree/8c997cef431fae2af74bd6c5a6c4df9000c27db6/src/cpmm): createCpmmPool and swap include devnet/RPC paths. Example mints are not necessarily Circle USDC; never copy their asset addresses blindly.
- [Raydium swap instruction](https://github.com/raydium-io/raydium-cp-swap/blob/244e1241f3c8d90eb93f176dfbc35f2605ec5a5c/programs/cp-swap/src/lib.rs): reviewed exact-input amount, minimum output, account/fee/state contract; actual downloaded devnet bytecode executes in local tests.
- [Raydium IDL](https://github.com/raydium-io/raydium-idl/blob/e7e0c96fe77bcf6a020b84a44c47a722aac8e359/raydium_cpmm/raydium_cp_swap.json): typed Anchor CPI source. Only address substitution to devnet and removal of docs fields. [Provenance](../idls/raydium.provenance.json) records binary hash, ProgramData, upgrade authority and deploy slot. Source/binary equivalence is not proven.
- [MagicBlock validator source ee62453](https://github.com/magicblock-labs/magicblock-validator/tree/ee62453): local ER version reported by the installed 0.14.10 package. Inspected committor behavior when diagnosing confirmation delay. Local lifecycle evidence is in [TESTING.md](TESTING.md).
- Installed `ephemeral-rollups-sdk` 0.17.0 `lib/utils.js`: source for scheduled/base commitment signature log prefixes in `tests/stack/commitment.ts`; application still confirms base transaction success and returned owner/revision independently.
- Installed Rust `ephemeral-rollups-sdk-attribute-ephemeral` 0.17.0 `src/lib.rs`, `generate_undelegate`: the generated `process_undelegation` callback targets writable `base_account` and validates the canonical undelegation buffer. The shared client's base-return observer decodes that callback from generated IDL rather than copying discriminator bytes.
- Installed TS SDK 0.17.0 `lib/resolver.js` and `lib/resolver.d.ts`: local record parser and validator identity; tests use this parser without introducing test endpoint maps into production routing.
- [Solana sendTransaction](https://solana.com/docs/rpc/http/sendtransaction): RPC acceptance is not confirmation; shared submission and keeper reconciliation expose these as separate states.
- [MagicBlock status](https://status.magicblock.app/api/services): public devnet Asia/Europe/USA services reported operational; TEE router down. Recheck for each live run.

## Required integration references

- [MagicBlock transaction lifecycle](https://docs.magicblock.gg/pages/ephemeral-rollups-ers/introduction/transactions)
- [Delegation](https://docs.magicblock.gg/pages/ephemeral-rollups-ers/how-to-guide/delegation)
- [Router](https://docs.magicblock.gg/pages/ephemeral-rollups-ers/api-reference/er/getDelegationStatus)
- [Local development](https://docs.magicblock.gg/pages/ephemeral-rollups-ers/how-to-guide/local-development)
- [Session Keys security](https://docs.magicblock.gg/pages/tools/session-keys/security)
- [Pricing Oracle](https://docs.magicblock.gg/pages/tools/oracle/introduction)
- [Solana PDA documentation](https://solana.com/docs/core/pda)
- [WSOL sync-native](https://solana.com/docs/tokens/basics/sync-native)
- [Anchor account constraints](https://www.anchor-lang.com/docs/references/account-constraints)
- [Anchor CPI](https://www.anchor-lang.com/docs/basics/cpi)

MagicBlock docs snapshot retained from prior research: `3660d4ad50cd3251cec860898311b08a339b7b17`. The installed MagicBlock skill's architecture, composition, security, delegation, session and local-validation references informed the plan; they are versioned guidance, not live service proof.

Npm metadata was refreshed before installing the exact pins in package.json/bun.lock. The dependency-free domain remains separate from the installed test/integration packages. Local fixtures bind a synthetic pool/configuration; no public devnet pool is provisioned. The V2 program identifier is a local test identifier, not an authorized release deployment. Read-only `scripts/fetch-raydium.sh` refuses an unreviewed bytecode hash rather than silently adopting a new upstream deployment.

Registry latest versions rechecked during the client work were ER SDK 0.17.0, Anchor TS 0.32.1, web3.js 1.98.4 and SPL Token 0.4.15. Exact pins were retained and workspace linking used disabled lifecycle scripts. This is a dated compatibility check, not permission to upgrade automatically. Service status was refreshed on 2026-09-06 IST; public devnet ER/router/oracles were operational, TEE router was down.

Older hackathon research, eSPL sources and prior compatibility evidence are preserved in [legacy/SOURCES.md](legacy/SOURCES.md). They do not establish runtime compatibility of the new architecture.
