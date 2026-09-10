# FLINCH interface review

Research date: 2026-09-06. Status: proposal, not an applied redesign.

The user rejected both the earlier arcade theme and the subsequent olive/apricot implementation. Passing UI tests did not establish visual quality. The attached screenshot is direct feedback on the current app, not approval of the provisional palette in brand.md.

## Diagnosis of the screenshot

| Before | Proposed change |
| --- | --- |
| Green-tinted background, borders, secondary text and pale sage/brick candles create an olive cast | Use genuinely neutral gray for the recommended theme. Keep blue for interaction, green/red for financial direction only |
| Header, full-width preview notice, heading and rule strip consume several horizontal bands before the game | Keep the environment warning, but consolidate the shell and room metadata. Do not conceal the read-only state |
| The market chart looks like the product while all four players are below the visible fold | Put player positions, room phase and timer beside the decision area. Keep reference market context visibly separate |
| Large chart header, toolbar, source label, footer and disclosure compete for attention | One compact market header, one toolbar, one explicit reference label; technical source details in disclosure |
| Creation and joining read as one long form with repeated explanatory text | Compact creation form; separate join mode or disclosure within the same bounded entry area |
| Most weights, borders and labels look equally important | Three type roles: round/action, financial value, supporting label. Filled input surfaces and restrained dividers |
| A disabled create button leaves the preview without an active product action | Preserve truthful disabled behavior; provide useful read-only navigation and help. Never enable transactions for visual effect |

This is not a diagnosis that all existing colors failed contrast. The previous contrast checks passed. The issue is visual hierarchy, color temperature, identity and information placement.

## Live products inspected

These are interface references, not endorsements of trading, gambling, security claims or business models. No wallets were connected, accounts created or financial actions taken.

### Rugs.fun

Source: https://rugs.fun/

The live page placed a compact history strip above a short chart; player outcomes occupied the chart's right edge; amount shortcuts and BUY/SELL were directly below. The screenshot showed active round transitions and actual participants. The chat sidebar was secondary to that cluster. Charcoal with a cooler cast, bright directional candles and large tactile actions gave the central game a distinct identity.

Borrow the proximity of game, participants and action. Do not copy its bubble font, chat, badges, leverage, partial sells, promotional history or simulated asset behavior. FLINCH's Coinbase reference line must never acquire fabricated player-fill markers or a crash multiplier.

### Bustabit

Source: https://bustabit.com/play

Observed a live rising multiplier and compact previous-round strip, a player/bet/profit table on the right, and chat below. The enormous multiplier made the current event legible immediately, despite a dated purple/orange theme. It is a hierarchy reference, not the recommended visual skin.

FLINCH's equivalent focal information is time remaining, remaining holders and the user's current position. It is not a multiplied balance or randomly crashing asset.

### Hyperliquid

Source: https://app.hyperliquid.xyz/trade

Observed the live HYPE-USDC trading screen: compact market statistics, chart integrated into the workspace and a narrow order form on the right. Small labels and aligned numbers preserve hierarchy. Aqua action and market direction stand apart from low-chroma dark surfaces. The initial announcement overlay competes with the form; do not copy that interruption.

Borrow the fixed action area, aligned amounts and compact grouping. Do not copy the broad navigation, leverage, market types or order complexity. Their data density serves a different product.

### Backpack

Source: https://backpack.exchange/trade/SOL_USD

Observed a public SOL/USD order book, neutral near-black panel hierarchy, filled amount inputs and a compact order form. On a 390px-wide rendered view, the workspace became task tabs and bottom Markets/Trade navigation. The chart itself remained loading, so its rendering quality and interaction are not verified here.

Borrow neutral surface roles and mobile task prioritization. FLINCH needs no market search, order book, exchange sidebar or duplicate BUY/SELL controls. A market-reference outage must remain independent of game recovery.

### Jupiter

Source: https://jup.ag/

The public swap form gives the amount fields and primary Connect action clear weight. Settings and mode controls are smaller. Filled sell input and outlined buy area distinguish related roles without identical cards everywhere. The surrounding promotions and broad sidebar clutter the page; they are not useful FLINCH references.

Borrow the focused financial form and progressive disclosure. Do not adopt Jupiter routing or any unrelated product from a UI study.

### Fasol

Source: https://fasol.fun/crash

Found through the product search and inspected the initial mechanics walkthrough plus cartoon and dark themes. The countdown and player list make the round phase explicit. The cartoon option uses cream, heavy borders and offset edges; dark mode uses green/violet glow. Neither is the recommendation for FLINCH. This is evidence that a recognizable game hierarchy can survive different skins, not that decoration makes a product good.

### Axiom limitation

Source: https://axiom.trade/

The public marketing page uses a black background and blue/violet brand accent. Its Launch Axiom link led to a discover URL that returned to marketing in this session. The authenticated terminal was not inspected; do not claim its actual trading interaction or compactness as observed evidence.

## Color sources and recommendation

- Radix Colors: https://www.radix-ui.com/colors . Inspected light/dark scales and individual swatch popovers with explicit usage roles. This is the most useful source for implementation tokens, not merely palette inspiration.
- Realtime Colors: https://www.realtimecolors.com/ . Inspected the live page and text/background/primary/secondary/accent toolbar. Useful for checking proportions on real sections before committing.
- Coolors Visualizer: https://coolors.co/visualizer . Its initial security wait resolved without interaction. Inspected the loaded visualizer introduction and UI/branding/typography template categories. Useful for combinations; not a complete accessible interaction system.

Recommended starting point: Radix neutral Gray plus Indigo, with SF/system typography. Verified dark swatches: Gray 1 `#111111`, Gray 2 `#191919`, Gray 3 `#222222`, Gray 6 `#3a3a3a`, Gray 11 `#b4b4b4`, Gray 12 `#eeeeee`, Indigo 9 `#3e63dd`. Blue 11 `#70b8ff` is an available high-contrast link/focus accent. These are role-specific values, not colors sampled from a competitor's brand.

The comparison at `artifacts/design-study/index.html` contains the recommended neutral/blue option, a custom cool/cyan alternative and a custom light/blue alternative. It does not write app tokens or save a selected brand. All show the same static layout so color is not confounded with a different composition. The amount and timing are current game defaults; no price series, player identities, results or transaction evidence is fabricated.

Representative WCAG contrast pairs were calculated independently; Radix's displayed APCA Lc scores are not WCAG ratio scores. Neutral/blue: action text 5.21:1, secondary text on raised surface 7.67:1. Cool/cyan: 6.30:1 and 7.40:1. Light/blue: 5.21:1 and 5.73:1. Body, links, input boundaries and focus also passed their selected 4.5:1 or 3:1 thresholds. This is not a full rendered-page audit or a finalized light/dark token system.

## Design brief

Direction: compact four-player game with restrained trading-tool precision.

Density: compact grouping, readable labels, 44px mobile actions. Not a marketing landing page or exchange dashboard.

Surface: neutral continuous workspace with a distinct action area, not many equal rounded cards.

Type: SF/system sans; three weights; tabular financial values; monospace limited to addresses and exact values where useful.

Motion: brief control feedback and meaningful game-state transitions only; no ambient glow, page-entry sequence or pulsing live dots.

Keep: all four positions visible near the decision, timer next to the round, clear estimated/minimum proceeds, independent reference chart, wallet confirmation and base-settlement truth.

Remove: olive/apricot palette, oversized market chrome, repeated disclaimers and empty decorative panels. Consolidation must not remove fee, risk or runtime distinctions.

## Next implementation gate

Get visual feedback on the proposal before applying a third theme. Then implement the selected layout in the existing shell/lobby/market/match/proof modules, not a new monolithic page. Verify the actual live/queued/returning/sold/claim states as well as the empty lobby. Do not confuse a static palette sample with a completed frontend.

For desktop, target the round, four players and primary decision within the first 1280×800 viewport. On mobile, keep the current position and action accessible without scrolling past large chart metadata. These are proposed acceptance criteria, not a claim that the current app meets them.

No application source, dependency, protocol or deployment change was made for this research pass. Existing test results belong to the prior implementation, not this proposal.
