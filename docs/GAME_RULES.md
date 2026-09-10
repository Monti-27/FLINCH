# FLINCH game rules

## Funding and time

Four distinct wallets deposit equal WSOL stakes into a room-specific base-layer vault. The program fixes all economic terms and the Raydium pool before funding. No seat without a successful deposit in the same transaction. Pre-start cancellation refunds exact deposits; after the funding deadline anyone may expire the lobby.

The base program starts a full room once, stores Clock time, and sets the 90-second end and 120-second recovery cutoff. The client must verify delegation before showing the room as playable. A failed delegation cannot prevent the later base recovery.

## SELL

HOLD is passive. The wallet or its approved session can queue SELL before round end, if at least two holders remain. A request includes a positive minimum USDC output and an increasing nonce. A seat can have one pending request, at most three accepted attempts, and one successful sale.

Two-second cohorts are anchored to the round start, not first arrival. No new cohort opens while an earlier batch is unresolved or while Control is returning/redelegating. The 90-second timer continues during these handoffs; the UI must show this pause honestly.

SELL acceptance is not a sale. The player's WSOL exposure ends only when the base swap succeeds. The final holder cannot sell through the game.

## Batch economics

Compute from current entitlements, including all previously earned holder bonuses:

`penalty[i] = floor(entitlement[i] × 25 / 10_000)`

`swap_input[i] = entitlement[i] - penalty[i]`

If no holder remains outside this batch, all penalties in the batch are zero. Otherwise distribute the total penalty equally to the remaining holders; give leftover base units in ascending immutable seat order. Sellers in the same batch never receive each other's penalties.

Swap the sum of net inputs once. Allocate actual received USDC proportionally to each seller's net input: floor each share, then allocate remaining units by largest fractional remainder, breaking ties by seat order. Validate each allocated output against that seller's immutable minimum. If any minimum fails, revert the entire transaction, including the swap and penalties.

There is no sell rank, forced lottery, or VRF-selected winner. Equal batch membership has equal treatment apart from explicitly bounded integer rounding.

## Failure and terminal outcomes

- A failed or expired swap charges no game penalty and credits no USDC. Network fees may still be paid. After expiry, consume the batch revision once before retrying a new intent.
- Execution is valid only from cohort close, inclusive, until close plus 15 seconds, exclusive. At expiry the old batch is dead even if its commitment arrives later.
- One holder after a successful fill ends the game; that holder may claim its WSOL.
- An all-holder batch can leave zero holders; all receive USDC and the round ends.
- A resolved final batch at/after round end ends with the remaining holders keeping their WSOL.
- Otherwise at end plus 30 seconds, permissionless base recovery terminates the ledger without needing Control, the ER, keeper, oracle, or DEX. All later fills reject terminal state. Unsold balances become claimable; earlier USDC claims remain intact.
- Recovery returns current entitlements, not initial stakes: earlier successful penalties and swaps remain final.

## Conservation

Track units separately; never add WSOL to USDC or claim constant dollar value:

`initial_wsol = cumulative_swap_input + current_wsol_entitlements + claimed_wsol`

`cumulative_usdc_received = current_usdc_claims + claimed_usdc`

Penalty units remain in the WSOL ledger. Observed DEX output, not an oracle price, determines USDC credit. Rejected transitions leave the domain object unchanged; onchain transactions must independently prove rollback.

Unsolicited transfers into a vault do not become game rewards. Require actual vault balances to cover ledger liabilities, not equal them; leave unaccounted surplus untouched for the V8 build.

## Market presentation

The funded devnet pool has its own test price and real test-token balances. A live SOL/USD oracle can be shown only as separate reference information. Never present an oracle mark as executable proceeds, stablecoin redemption, or mainnet liquidity.
