# FLINCH security and recovery plan

Historical token-exit design, superseded on 2026-09-05. See the current documents in docs/. Retained to explain the unmigrated Anchor program; not the current build specification.

## Scope

This is a devnet hackathon build handling valueless test assets. It must still preserve balances exactly and demonstrate honest cross-runtime state. It is not approved for mainnet deposits or real-money operation.

## Security boundaries

| Boundary | Trusted for | Not trusted for |
| --- | --- | --- |
| FLINCH program | rules, authorization, rank, arithmetic, payout state | network availability |
| Solana base | durable account and token settlement | instant ER state visibility |
| public ER | fast execution of delegated accounts | base finality before commit |
| Router | account placement discovery | game authorization |
| eSPL program | token custody/delegation lifecycle | player eligibility or rank |
| Session Keys | temporary signer binding and expiry | SPL ownership or game-specific limits unless FLINCH enforces them |
| Pricing Oracle | authorized price-account update path | payout authority or guaranteed availability |
| VRF | authenticated unpredictable bytes | completion before callback |
| browser | transaction construction and presentation | time, ordering, balances, or settlement truth |
| keeper/bots | permissionless liveness calls | privileged resolution or custody |

## Assets to protect

- the exact funded WSOL pool;
- one seat and one sell action per wallet;
- fair ordering inside a cohort;
- one terminal holder and a conserved payout ledger;
- withdrawal authority;
- session private keys and deployment credentials;
- truthful ER, base, oracle, and VRF status in the UI.

## Threat model

### Forged player or session

Attack: a caller submits SELL for another seat or reuses a session from another app.

Controls:

- bind `SessionTokenV2` to expected wallet, signer, and FLINCH program;
- map the authority to the stored player seat;
- accept session signing only on `queue_sell`;
- enforce expiry and revocation onchain;
- require a monotonically increasing action nonce;
- keep withdrawal and recovery wallet-only.

### Duplicate or reordered actions

Attack: retries or concurrent clients produce multiple sells or payouts.

Controls:

- state gate `Holding -> PendingSell -> Sold`;
- one stored nonce per player;
- one persisted active cohort;
- one sell rank per seat;
- set payout-claimed state in the same transaction as transfer;
- make terminal finalization idempotent.

### Transaction-order advantage

Attack: bots race for a preferred rank inside normal network ordering.

Controls:

- group intents by onchain two-second cohort;
- treat all members of a cohort as simultaneous;
- use scoped VRF to assign rank within multi-seller cohorts;
- pause later cohort acceptance while randomness is unresolved;
- disclose cohort semantics in the UI.

The two-second rule reduces but does not eliminate strategic timing around cohort boundaries. It is a visible game rule, not a claim of continuous-time fairness.

### Spoofed, duplicate, or late VRF callback

Attack: arbitrary randomness changes a payout or an old callback resolves a new request.

Controls:

- use `#[vrf]` on request and `#[vrf_callback]` on callback;
- bind callback to Round, cohort index, bitmap, rank range, and nonce;
- consume the nonce once;
- persist `Fulfilled` or `TimedOut` before economic effects;
- reject late callbacks after timeout;
- test wrong signer, wrong queue, duplicate, stale nonce, and reordered callback.

### VRF liveness failure

Attack: callback never arrives and funds remain trapped.

Controls:

- ten-second onchain timeout from persisted request time;
- permissionless timeout resolver;
- average the total unresolved rank penalty across actual sellers with deterministic remainder allocation;
- use lowest wallet pubkey as the holder only when every active player attempted to sell;
- preserve exact pool conservation;
- expose fallback use in the receipt.

### Wrong account or mint substitution

Attack: a caller supplies an attacker-controlled token account, feed, delegation record, or program.

Controls:

- validate WSOL mint and Token Program;
- derive Round token account and every external PDA with current SDK/API helpers;
- validate token account owner, mint, and expected authority;
- pin known external program IDs;
- validate delegation buffer, record, and metadata derivations;
- validate oracle account plus feed ID and exponent;
- reject remaining-account substitutions.

### Cross-validator account mismatch

Attack/failure: writable accounts are delegated to different ER validators and a transaction cannot execute coherently.

Controls:

- select one validator identity before any room delegation;
- pass it to Round and every eSPL delegation;
- query `getDelegationStatus` for all writable delegated accounts;
- require one FQDN before join/start/payout;
- surface recovery instead of silently selecting another endpoint.

### Price-feed manipulation or staleness

Attack/failure: wrong, zero, stale, or malformed price appears in the replay.

Controls:

- validate the canonical account, provider/feed ID, exponent, posting slot, positive domain, and upstream publish time;
- use checked integer conversion;
- never let price control rank or payout;
- store `valid: false` rather than stale data;
- visibly distinguish verified snapshots from client chart samples.

### Arithmetic or conservation failure

Attack/failure: overflow, rounding, or partial payout strands or creates units.

Controls:

- multiply in widened integers;
- calculate each fixed-rank penalty from original stake;
- transfer the exact remaining pool balance to the holder;
- assert running `total_paid + pool_balance = funded_total`;
- test stake bounds, maximum values, timeout remainder allocation, and every seller combination.

### Premature settlement claim

Attack/failure: UI says funds are final while only the ER transaction succeeded.

Controls:

- separate ER-confirmed, base-confirmed, withdrawable, and withdrawn states;
- extract base commit signature from ER logs and confirm it independently;
- verify base account owner restoration before withdrawal;
- compare destination ATA balance before and after withdrawal;
- retain all signatures in the demo proof bundle.

### Malicious host

Attack: host changes terms, blocks payout, or cancels after seeing play.

Controls:

- freeze mint, stake, timing, capacity, and penalties when funding begins;
- no host cancellation after `Live`;
- cohort resolution, timeout, payout, and finalization are permissionless;
- no admin transfer or upgrade path in the game state;
- display immutable parameters before deposit.

### Compromised browser session key

Impact: attacker may submit the one SELL action before expiry.

Controls:

- session scoped only to FLINCH and `queue_sell` policy;
- expiry shortly after the round;
- no token delegate required after stake custody moves to the Round;
- secret remains in memory or protected session storage and is never logged;
- wallet-accessible revoke flow;
- direct wallet fallback remains available.

## Account validation checklist

Every instruction must validate the minimum applicable set:

- expected signer or PDA signer seeds;
- program ownership and executable program IDs;
- Round PDA derivation and bump;
- Round status and immutable configuration;
- player membership and unique seat;
- token account mint, owner, authority, and exact address;
- external PDA derivation through current SDK/API;
- Clock-based boundaries;
- checked arithmetic and safe casts;
- delegated-account placement before the client sends an ER transaction;
- VRF scoped identity and request correlation;
- oracle identity, freshness, domain, and exponent.

## Upgrade and administration policy

For the hackathon, deploy with a controlled upgrade authority so critical bugs can be corrected. Publish the authority address in the README after deployment. The program has no economic admin instruction and no withdrawal override. A post-hackathon mainnet plan must move upgrade authority to a multisig or make the program immutable after review.

## Recovery runbooks

### Funding succeeded but delegation failed

1. Read source ATA, Global Vault ATA, eATA, and delegation state on base.
2. Do not repeat the full deposit blindly.
3. Rebuild only the missing idempotent lifecycle step with the pinned SDK.
4. If the player cannot be made ER-ready before the deadline, return the deposit through the supported eSPL path and cancel the seat.

### Round or eATA placed on the wrong validator

1. Stop the room before `Live`.
2. Record all router FQDNs and base owners.
3. Undelegate the mismatched account through its actual ER.
4. Confirm the base commitment and restored ownership.
5. Redelegate to the room validator and verify all accounts again.

### VRF callback missing

1. Keep `TiePending` visible.
2. After the onchain ten-second deadline, call `resolve_tie_timeout`.
3. Record that fallback was used.
4. Ignore any later callback for the consumed nonce.

### Round settled on ER but base commit is delayed

1. Preserve the ER and extracted commitment signatures.
2. Poll router status, base ownership, and base account data with a bounded backoff.
3. Do not issue a second non-idempotent payout.
4. Retry only the current SDK-supported commit/undelegation operation when state proves it safe.

### eSPL withdrawal fails

1. Verify the exact builder path used.
2. Verify the base commitment is confirmed and eATA ownership is restored.
3. Read Global Vault ATA, eATA, and destination ATA balances.
4. Rebuild the withdrawal from current state.
5. Mark complete only after destination balance delta is observed.

## Secrets and logging

Never commit or log:

- wallet seed phrases or private keys;
- session signer secret keys;
- deployment or keeper keypairs;
- authenticated RPC URLs;
- bearer tokens;
- full signed transactions before submission.

Logs may include public keys, program IDs, endpoint hostnames, state labels, public transaction signatures, amounts in devnet WSOL, and sanitized errors. The final check must scan tracked and untracked project files for secrets and keypair-shaped arrays.

## Mainnet blockers

Before any real-value launch, require an external program review, economic/game-theory review, legal analysis, operational key plan, RPC/validator redundancy plan, load and griefing tests, monitoring and incident response, upgrade governance, explicit terms, and a fresh audit of every pinned MagicBlock dependency. V8 completion does not satisfy these requirements.
