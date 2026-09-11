# Executable pool quotes

The quote adapter reads the fixed Raydium devnet CPMM venue directly. It never substitutes an oracle mark. Quote computation is an estimate against observed test liquidity, not proof of a sale or a guarantee against intervening swaps.

## Quote timing correction, 2026-09-11

The previous refresh path obtained a fresh quote and then repeated the base-room/router/ER read chain. A deterministic reproduction crossed the two-second cohort on all three attempts while 84 seconds remained in the round. A separate two-second pool-observation limit also remains in force; the round countdown is not a quote lifetime.

`FlinchClient.quoteContext` now returns the quote and the independently verified route/Control together. It reads the pool before resolving Control so a slower pool response cannot leave an older ER Clock waiting in parallel. `observationTime` conservatively counts elapsed time from the start of that resolution, including network delay, and rejects observations at two seconds or a backwards wall clock. Validation after blockhash loading uses that elapsed time too. This is client-side admission estimation, not a guarantee of onchain cohort inclusion.

Explicit refresh mode uses one context before approval and another after approval, without the redundant read chain. Both preserve the originally approved minimum, room, venue, revision, seat, nonce, holdings, seller mask and slippage. Submission also checks the signer and original endpoint, then sends the exact signed bytes once. The strict non-refresh API still expires observations. No quote lifetime, minimum, onchain rule, replay limit or uncertain-broadcast behavior was relaxed.

At round end, client errors distinguish closed selling from a transient quote expiry. The interface shows finalizing positions until the base ledger is terminal; a zero countdown alone does not establish settlement or withdrawal availability.

## Automatic frontend refresh, 2026-09-11

The visible ticket now loads automatically and refreshes about once per second while its seated wallet can sell, sooner when a response approaches expiry, with at least 250ms between completed reads. It keeps the last observed estimate during refresh, coalesces concurrent reads, backs off failures up to eight seconds and cancels publication of superseded responses. Hidden/offline tabs, wallet/room changes, pending approvals, queued sells and unavailable Control stop the loop. Returning to an eligible visible state requests a fresh quote immediately. Background reads never sign or submit.

The feed identity includes the canonical ledger revision. A confirmed sale immediately removes the previous position's quote and cancels its obsolete reads. SELL stays disabled until the displayed quote matches the current room, pool, ledger/Control revision, seat, nonce, holdings and seller mask. This prevents a click from interrupting the replacement read and repeatedly submitting an old-position quote for review. Time-only expiry may still use protected refresh; a different position requires a newly displayed quote.

Pressing SELL freezes the displayed positive minimum and enters the existing wallet operation guard before obtaining a new quote. The frontend opts into `prepareQuotedSell`'s `refreshQuote` mode. Fresh estimates may advance to a later open cohort only when the room, venue, revision, seat, nonce, holdings, known sellers and slippage setting still match; the pool slot cannot go backwards. The approved minimum never changes. A fresh conservative output below that minimum rejects before sending and asks the player to review the updated price.

The same fresh-price and placement checks run after wallet approval, so an approval lasting over two seconds need not fail merely because the original observation aged out. The already-signed bytes are sent unchanged, once, through the journaled endpoint. At most three read/preparation attempts handle quote timing races before a signature is requested or before broadcast. Cancellation, changed positions, price-bound failures and uncertain broadcasts never trigger automatic signing or resubmission. The strict default client API still rejects expired quotes; only the explicit refresh mode renews observations. The two-second age limit, onchain minimum, attempt limit and 90-second round are unchanged.

Claims are not swaps: they transfer confirmed base-ledger entitlements and do not fetch or depend on a price quote. No new program deployment is required for this client/UI change. See TESTING for current validation and deployment status.

## Boundary

Resolve pool dependencies, then read pool/configuration/vaults/observation/mints/Clock/program together at confirmed commitment, no older than the room snapshot. Validate the owners, exact reviewed layouts, expected mints/decimals/token programs, pool authority, observation association, swap status and opening time. Reject changed dependency addresses between discovery and the coherent read.

Net reserves exclude accrued protocol, fund and creator fees. Input/output rounding and creator-fee direction follow Raydium CPMM source `244e1241f3c8d90eb93f176dfbc35f2605ec5a5c`. The adapter uses the existing reviewed IDL and integer arithmetic; it does not add the alpha SDK or implement a new exchange. Twelve tested combinations of both orientations, all creator-fee modes and enabled/disabled creator fees match actual downloaded Raydium bytecode output, including nonzero accrued fees. Source/bytecode equivalence remains a separate unverified claim.

## Cohort uncertainty

Other holders may join the same two-second cohort. For the requesting seat, enumerate every possible seller subset that includes the already-pending sellers and the requesting seat. Calculate aggregate swap input, estimated output and proportional allocation for each. Quote the output range and apply the user's slippage bound to its lowest allocation. All-sell scenarios waive the holder penalty. This accounts for cohort composition at the observed reserves, not future liquidity changes or another seller's incompatible minimum.

The returned quote binds room, revision, seat, next nonce, holdings, known seller mask, cohort and pool slot. Each observation expires two seconds after the pool response. Re-read placement and validate the binding before signing and sending; the explicit frontend refresh mode above can replace expired observations without changing the approved minimum or signed transaction. Never lower a minimum or re-sign silently. The program remains the authority for intent acceptance and actual fill allocation.

Game penalty, trading fee, input/output creator fees, network fees and slippage are distinct. Protocol/fund fees are portions of the trading fee, not additional charges. Do not add WSOL-denominated fees to USDC-denominated fees. The UI shows estimated proceeds, maximum game penalty, signed minimum, fixed 100-bps slippage and expiry. Fee breakdowns remain available in the curve result; UI proceeds include DEX fees rather than adding them again.

`prepareQuotedSell` verifies the signer and checks expiry after blockhash loading immediately before prompting. Its strict default checks the same observation again after signing; refresh mode obtains another protected context inside `submitQuotedSell`. Submission independently resolves the current route as part of that context and validates the binding before sending. Browser SELL prepares only inside the operation guard and journals that verified endpoint. A validation failure before send is explicitly `SellNotSubmittedError`, not an uncertain broadcast. Sessions remain the low-friction signing path; both wallet and session modes preserve the approved minimum.

Pool reads previously ran concurrently with placement resolution; the timing correction above supersedes that ordering. Within resolution, ER identity and Control/Clock still run concurrently, but identity must validate before any Control interpretation. No placement cache or validation bypass is used. Historical public devnet browser run `devnet-browser-e54FJZ` passed session and direct-wallet sales with the earlier ordering; two unsent preparations still required an explicit fresh quote.

The visible ticket uses the ER Clock observation for admission/cohort freshness, separately from the base Clock used for round/recovery display. A stale or failed Control read disables SELL without discarding confirmed Ledger balances or disabling independent base recovery. The ticket shows the minimum directly; exact maximum penalty and slippage are available in its fee disclosure. Historical `mb-stack-ltcg1A` verified the previous manual-refresh behavior. Automatic quote refresh replaces that UX, not the no-automatic-intent requirement. Client freshness is still not an onchain cohort-inclusion guarantee.

The current onchain queue instruction does not include a quote timestamp or expected cohort parameter. These freshness checks constrain client submission, not later network inclusion; a delayed transaction can enter a later still-open cohort with the same immutable minimum. Onchain minima protect output but do not promise cohort inclusion or execution. Consider explicit cohort-bound admission in a separately reviewed protocol change.
