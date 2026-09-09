# Executable pool quotes

The quote adapter reads the fixed Raydium devnet CPMM venue directly. It never substitutes an oracle mark. Quote computation is an estimate against observed test liquidity, not proof of a sale or a guarantee against intervening swaps.

## Boundary

Resolve pool dependencies, then read pool/configuration/vaults/observation/mints/Clock/program together at confirmed commitment, no older than the room snapshot. Validate the owners, exact reviewed layouts, expected mints/decimals/token programs, pool authority, observation association, swap status and opening time. Reject changed dependency addresses between discovery and the coherent read.

Net reserves exclude accrued protocol, fund and creator fees. Input/output rounding and creator-fee direction follow Raydium CPMM source `244e1241f3c8d90eb93f176dfbc35f2605ec5a5c`. The adapter uses the existing reviewed IDL and integer arithmetic; it does not add the alpha SDK or implement a new exchange. Twelve tested combinations of both orientations, all creator-fee modes and enabled/disabled creator fees match actual downloaded Raydium bytecode output, including nonzero accrued fees. Source/bytecode equivalence remains a separate unverified claim.

## Cohort uncertainty

Other holders may join the same two-second cohort. For the requesting seat, enumerate every possible seller subset that includes the already-pending sellers and the requesting seat. Calculate aggregate swap input, estimated output and proportional allocation for each. Quote the output range and apply the user's slippage bound to its lowest allocation. All-sell scenarios waive the holder penalty. This accounts for cohort composition at the observed reserves, not future liquidity changes or another seller's incompatible minimum.

The returned quote binds room, revision, seat, next nonce, holdings, known seller mask, cohort and pool slot. It expires two seconds after the pool response. Re-read placement and validate the binding before signing; after wallet interaction, reject expired quotes before sending. Never lower a minimum or re-sign silently. The program remains the authority for intent acceptance and actual fill allocation.

Game penalty, trading fee, input/output creator fees, network fees and slippage are distinct. Protocol/fund fees are portions of the trading fee, not additional charges. Do not add WSOL-denominated fees to USDC-denominated fees. The UI shows estimated proceeds, maximum game penalty, signed minimum, fixed 100-bps slippage and expiry. Fee breakdowns remain available in the curve result; UI proceeds include DEX fees rather than adding them again.

`prepareQuotedSell` verifies the signer and checks expiry after blockhash loading immediately before prompting, then again after signing. `submitQuotedSell` independently re-resolves the current route and validates the binding before sending. Browser SELL prepares only inside the operation guard and journals that verified endpoint; it does not do a third preliminary route lookup. A validation failure before send is explicitly `SellNotSubmittedError`, not an uncertain broadcast. No automatic refresh, repricing or re-signing. Wallet mode can expire while the user approves; the intended low-friction path is a previously authorized session.

Pool reads and placement resolution run concurrently after the base room read. Within resolution, ER identity and Control/Clock are fetched concurrently, but identity must validate before any Control interpretation. This reduces network latency without caching placement, changing quote age or skipping validation. The public devnet browser run `devnet-browser-e54FJZ` passed session and direct-wallet sales after this change; two unsent preparations still required an explicit fresh quote.

The visible ticket uses the ER Clock observation for admission/cohort freshness, separately from the base Clock used for round/recovery display. A stale or failed Control read disables SELL without discarding confirmed Ledger balances or disabling independent base recovery. The ticket shows the signed minimum directly; exact maximum penalty and slippage are available in its fee disclosure. `mb-stack-ltcg1A` verifies an explicitly expired quote creates no automatic intent and requires a deliberate refresh before submission. Client freshness is still not an onchain cohort-inclusion guarantee.

The current onchain queue instruction does not include a quote timestamp or expected cohort parameter. These freshness checks constrain client submission, not later network inclusion; a delayed transaction can enter a later still-open cohort with the same immutable minimum. Onchain minima protect output but do not promise cohort inclusion or execution. Consider explicit cohort-bound admission in a separately reviewed protocol change.
