# FLINCH frontend and demo specification

Historical token-exit design, superseded on 2026-09-05. See the current documents in docs/. Retained to explain the unmigrated Anchor program; not the current build specification.

## Experience goal

The interface should feel like a live market under social pressure, not a dashboard around a smart contract. The chart is the room. Player exits, the shrinking clock, and the growing holder reward are drawn directly into that space.

## Proposed stack

- Next.js with TypeScript
- React
- Tailwind CSS with a small token-based design system
- Solana wallet adapter
- Anchor TypeScript client
- MagicBlock ER SDK or kit selected by the compatibility spike
- GUM SDK for Session Keys
- a lightweight chart renderer using SVG or Canvas
- Vitest and Testing Library
- Playwright for the critical demo path

Do not add a state-management library until the connection and transaction state machine proves React primitives insufficient. Chain state remains authoritative; client caches are disposable.

## Visual direction

FLINCH should look like a brutalist live trading broadcast:

- near-black background;
- warm off-white type;
- acid green for held value and confirmed gains;
- red-orange for SELL, penalties, and exits;
- amber for pending or degraded external services;
- a large condensed display face for countdown and amounts;
- a neutral sans face for controls and status;
- sharp borders, dense tick marks, and restrained motion;
- no purple gradients, glass panels, slot-machine decoration, or generic Web3 blobs.

The logo moment is the word `FLINCH` with one letter or cursor snapping away under pressure. It must remain readable at thumbnail size.

## Primary screen

Desktop composition:

```text
+---------------------------------------------------------------+
| FLINCH     SOL / USD       01:12        ER LIVE      room code |
+---------------------------------------------------------------+
|                                                               |
|                     FULL-WIDTH LIVE CHART                     |
|                                                               |
|  A HOLDING       B SOLD -20%       C HOLDING       D HOLDING  |
|  sell markers and penalty transfers appear on the timeline    |
|                                                               |
+-------------------------------------------+-------------------+
| YOU RECEIVE IF YOU SELL NOW               | HOLDER POT        |
| 0.0880 WSOL                               | 0.1320 WSOL       |
| about $14.20                              | growing           |
|                                           |                   |
| [ HOLDING. SELL AND PAY 12% ]             | network state     |
+-------------------------------------------+-------------------+
```

Mobile keeps the chart, countdown, current exit amount, holder pot, and SELL control above the fold. Secondary proof and replay details may move below.

## Screens

### Landing

- one-sentence rule;
- `Create room` primary action;
- `Watch demo` secondary action;
- one compact animated example showing an early seller funding holders;
- no feature-card wall.

### Create room

- fixed four seats, 90 seconds, WSOL, and canonical penalties shown as rules, not customizable controls;
- stake selector restricted to the deployment range;
- validator selection automatic and hidden unless diagnostics are expanded;
- explicit devnet label;
- preview of maximum loss and exact starting deposit.

### Lobby

- four seats and deposit status;
- one progress pipeline per player: wallet funded, eSPL delegated, ER ready, session ready;
- shareable invite link;
- bot-fill action for the demo;
- start remains disabled until every required account resolves to one ER.

### Live room

- full-width live SOL/USD chart;
- server/onchain countdown derived from Round timestamps;
- visible player chips anchored to the chart;
- exact current SELL payout and penalty;
- projected holder reward;
- one large irreversible SELL control;
- status strip for ER, oracle, VRF, and base settlement.

HOLD is passive. There is no HOLD button.

### Tie reveal

- freeze the affected cohort markers;
- label `Verifiable tie-break requested`;
- show VRF pending without fake roulette;
- reveal the order with a short, deterministic animation after callback confirmation;
- link the request and callback signatures in diagnostics;
- show `Fallback ordering` if the timeout path ran.

### Result

- final holder and complete payout table;
- original stake, penalty, token payout, and contextual USD value;
- replay timeline with sell cohorts and verified oracle samples;
- settlement progress separated into ER settled, returning to Solana, withdrawable, and withdrawn;
- withdraw and optional unwrap as separate actions.

## Transaction state model

Every action uses explicit phases:

```text
idle
  -> awaiting_wallet
  -> submitted
  -> confirmed_on_target_runtime
  -> observing_cross_runtime_effect
  -> complete
```

Failures move to `retryable`, `recovery_required`, or `terminal_failure`. A signature alone is not enough when the operation includes a callback, commit, undelegation, or withdrawal.

### Copy vocabulary

Use:

- `Sell queued`
- `Sold on MagicBlock`
- `Tie-break pending`
- `Settled on MagicBlock`
- `Returning to Solana`
- `Ready to withdraw`
- `Withdrawn`

Never use:

- `Cash received` before base withdrawal;
- `Sold to USDC` when the user received WSOL;
- `Final` while a callback or base commitment is pending;
- `Guaranteed` for network timing.

## Data architecture

### Authoritative data

- Round account from the resolved ER while delegated;
- Round account from base after terminal commit;
- ER token-account balances during play;
- base token-account balances after withdrawal;
- router placement and ownership checks;
- VRF callback state;
- validated oracle samples.

### Presentation-only data

- interpolated chart animation;
- optimistic button disable state;
- local countdown rendering between Clock-derived refreshes;
- cached room metadata;
- client-only high-frequency chart points.

Presentation data cannot assign rank, calculate final payout, or advance lifecycle state.

## Connection coordinator

One client module owns:

- base connection;
- router client;
- current ER connection and WebSocket;
- delegation-status cache with bounded lifetime;
- runtime-specific blockhash selection;
- confirmation and retry policies;
- subscription teardown when a room changes runtime.

Before a multi-account ER transaction, it verifies that every writable delegated account maps to the same FQDN. It must not silently reroute a partially built transaction.

## Session UX

1. Explain that the session enables one no-popup SELL during this round.
2. Generate the session signer in the browser.
3. Ask the wallet to create the session token with an expiry shortly after expected round completion.
4. Hold the secret only in memory or protected session storage.
5. Display expiry and a revoke control in the lobby/result.
6. Fall back to direct wallet signing if session creation fails before the round.
7. Never log or send the secret to analytics.

Because stake custody transfers to the Round during join, the SELL session does not need token delegate authority.

## Oracle chart

The chart may render frequent client samples, but only program-validated snapshots can carry a verification mark in replay.

Each marked sample shows:

- raw price and exponent;
- publish time;
- local posting slot;
- transaction or account reference.

When the feed exceeds the configured age, freeze the last visual value, desaturate the line, and display `PRICE STALE`. The SELL control remains available because price does not determine payout.

## Accessibility and input safety

- SELL is keyboard reachable and has a visible focus state.
- A confirmation sheet states exact payout and penalty, but does not add a long countdown that makes the action unusable.
- Color is never the only indicator of player or settlement state.
- Reduced-motion mode removes chart camera moves and reveal animation.
- Countdown announcements are rate-limited for screen readers.
- Mobile touch targets are at least 44 px.
- Monetary values use tabular numerals and explicit token units.

## Demo mode

The judge path must work with one human and three funded bots. Bots are ordinary program participants controlled by a local demo operator; they do not bypass authorization or write state directly.

Scripted three-minute flow:

1. Create a devnet room and fill three seats with bots.
2. Show one wallet approval for funding and session creation.
3. Start the 90-second room.
4. Trigger a bot exit and show the holder pot grow.
5. Trigger a two-player cohort and show the VRF request/reveal.
6. Human holds to become final holder.
7. Show the conserved payout table.
8. Undelegate, confirm base ownership, withdraw WSOL, and show the wallet delta.
9. Open proof details with ER, VRF, commit, and withdrawal signatures.

The demo script must have a deterministic orchestration mode for timing, but it cannot fabricate chain confirmations or VRF data.

## Error presentation

| Condition | User message | Available action |
| --- | --- | --- |
| account still delegating | `Preparing your seat on MagicBlock` | retry status check |
| wrong ER placement | `This seat landed on another validator` | recover and redelegate |
| session expired | `Your one-tap session expired` | sign SELL with wallet if still live |
| oracle stale | `Live price is temporarily stale` | continue playing |
| VRF pending | `Verifiable tie-break is pending` | wait; timeout resolver becomes available |
| base commit pending | `Your result is returning to Solana` | keep observing |
| withdrawal failed | `Funds remain withdrawable` | retry withdrawal |

Never reduce these states to a generic transaction error.

## Frontend completion gates

- a new user can state the rule after the landing animation;
- the current penalty and exact token payout are visible before SELL;
- all four player states update from chain subscriptions;
- reconnecting reconstructs the room from chain and router state;
- stale oracle does not disable SELL or settlement;
- duplicate button activation submits at most one logical action;
- the UI never shows withdrawn before base balance confirmation;
- production build, type check, unit tests, and the critical Playwright journey pass;
- desktop and mobile captures contain no clipped values or hidden recovery state.
