# FLINCH frontend

## Arena skeletons, 2026-09-11

`/play` now reserves its arena layout during startup and initial room reads, with independent chart-code/history and price placeholders. Quote and receipt reads use matching shapes. A reusable token-colored shimmer stops for reduced motion; known chart history and same-room receipts remain visible during background refreshes. Failed reads keep recovery controls. Shared layout, timer and stake-control geometry prevent loading-only redesigns. See [loading states](LOADING_STATES.md) for ownership, sequence, browser checks and scope limits. No signing, routing or economic rules changed.

## Rolling numbers, 2026-09-11

Live reference prices and confirmed holdings use the controlled NumberFlow component with exact decimal strings, brief directional feedback, reserved arrow space and live reduced-motion support. Static signed amounts and editable inputs retain their existing behavior. See [NUMBER_ANIMATION](NUMBER_ANIMATION.md) for component setup, precision, motion and test scope. Concurrent chart, timer and footer changes are separate.

## Reference hands footer, 2026-09-11

The shared footer now uses reference-derived ASCII hand masks instead of the Waves canvas. `footer-hands.tsx` isolates Framer Motion entrance, visibility and pause lifecycle; `footer.css` handles continuous masked color flow and responsive composition. The wordmark stays visible. Native footer controls, network disclosures, official icons and logo geometry are unchanged. This supersedes historical shader-footer instructions below. See [FOOTER](FOOTER.md) and the final browser evidence in TESTING. No wallet, financial or protocol code changed.

## Protocol bento, 2026-09-11

Latest refinement: only the first two designs change. Custody uses four equal Solana-marked stake chips settling into a recessed tray beneath a stationary WSOL heading. Rollup uses a layered Control panel, three intent records and fixed base custody. The panel has clearance through its whole return; neither of these two tiles has a bottom fade. Other three scene components keep their design. All five repeat on a quicker 4.05-second cycle. No replay buttons, bottom caption or bento pause control is added. A concurrent task removed the footer motion control; the existing ambient state binding remains. This task does not edit the footer. See BENTO_DESIGN for the reference study and timing, and `bento-containment-browser.ts` for per-frame clipping/reset checks at seven widths.

Follow-up: removed the old `GameStory`/`RuleIllustration` band and `story.module.css` after the user explicitly dropped it. The existing bento is the single feature grid; hero/navigation links target it and the old hash is retained as an inert positional alias. `rollup-scene.tsx` now uses its own `rollup.module.css`, keeping new miniature styles separate from the four unchanged scenes. Its moving Control ticket and batch sheets sit inside one workspace; the base custody row never moves. Landing SSR/browser tests assert no old rule grid, five bento cards and both current/legacy anchors. Motion tests also measure stationary custody independently of the animated ticket.

`features/landing/bento/protocol-bento.tsx` composes five scene components inside a small client boundary. `bento-state.ts` creates an isolated Zustand store for visibility, phase and bounded cycle counters; `bento-motion.tsx` owns per-card in-view checks, timer disposal, the shared spring and live reduced-motion behavior. Static server frames remain useful before hydration. Per-frame interpolation belongs to Framer Motion, not React state. Scene modules never import wallet, RPC, session or market services. The 3+2 grid becomes two columns on tablet and one on mobile; motion stays inside fixed card geometry. Official ecosystem assets are reused through `EcosystemIcon`.

The old process-card markup/styles are removed from `landing-details.tsx` and its CSS module; the FAQ is unchanged. There is no dependency, financial logic, hero, rule-card, footer or global theme change in this slice. `bento.test.tsx`, `bento-browser.ts` and `bento-motion-browser.ts` cover state/SSR, responsive presentation and real browser motion respectively. See BENTO_DESIGN and TESTING.

## KLineCharts and aligned actions, 2026-09-11

The reference chart uses KLineCharts 10.0.3 with a client-only import, near-black plot, five native presentation modes, 1m/2m/5m periods, optional observed volume (off by default), UTC axes, crosshair, reset and fullscreen. Line is unfilled; Mountain uses a neutral flat fill. Historical view position survives data replacement, and actual ticks are frame-batched without interpolated prices. Desktop action/chart panels share both edges; mobile keeps actions first and toolbar controls in one row. This supersedes older bounded-height/Lightweight Charts guidance below. Read [CHART](CHART.md) for source ownership, volume semantics, validation and limitations. Chart semantic tokens change, but financial handlers and palette primitives do not; concurrent footer and landing work is preserved.

## Reference-led landing and 404, 2026-09-11

The new video references replace the landing's pinned story and parallax with a pale, bounded product page and one-shot word/panel reveals. The `/play` theme, wallet boundaries and existing footer stay unchanged. `features/landing/reveal.tsx` owns IntersectionObserver and Web Animations lifecycle; `reveal-words.tsx` preserves semantic text; `game-story.tsx` and `rule-illustration.tsx` own the four rules; `landing-details.tsx` owns the staggered execution steps and native FAQ. All colors are scoped to the landing using existing primitives. The former story-stage component/store are retired, not carried as dead code.

`features/not-found` separates bounded component-local flower state, original pixel geometry, accessible planting controls and CSS. The server-rendered missing page keeps the approved brand and real home/arena links, returns 404/noindex and adds no footer or provider. Click, touch, keyboard, clear, live reduced motion and no-JavaScript recovery have dedicated tests. The landing continues to mount no wallet, market or RPC provider. See LANDING_PAGE for the exact motion policy, reference inspection and preserved image license, and TESTING for validation.

## Sonner notifications, 2026-09-11

`components/ui/notification-toaster.tsx` owns the single official Sonner host. It uses dark `richColors`, bottom-right placement, 24px desktop gutters and 16px mobile gutters with bottom safe-area support. `styles/notifications.css` owns only the branded neutral surface, font, radius, floating shadow and 44px close hit area; it no longer overrides the library's success/error/warning/info colors. Native icons, live-region announcements, Alt+T access, dismissal and global reduced-motion behavior remain.

`lib/notifications.ts` owns action-specific titles, descriptions and severity. `operationNotification` distinguishes completed base actions from accepted ER requests, unknown confirmation and known failure. `action-errors.ts` translates provider errors and bounded nested wallet rejection codes/messages into safe, actionable copy without exposing raw provider logs or URLs. A pending journal entry takes precedence over cancellation text; the UI never infers an unsent request from a network error after submission.

`notify-action.ts` is the Sonner boundary. Loading updates use the same toast ID; errors retain an internal cause and a handled marker so feature catches cannot notify twice. Wallet connection/disconnection errors have their own callback, while signing errors belong to the action flow. User cancellation produces a blue "Request cancelled" toast. Creation, funding, selling, claims, manual checks and form validation no longer render duplicate raw errors. Invalid-field focus and draft values remain. `TransactionStatus` retains expandable proof and pending retry guidance, not arbitrary message strings. Persistent offline/read-availability states are not converted into repeated background toasts. Signing, balances, journal semantics and the footer are unchanged. Reference: [Sonner](https://sonner.emilkowal.ski/).

## Landing and arena routes, 2026-09-09

`/` now server-renders the product introduction; `/play` mounts the existing `Application`. `features/landing` separates composition, landscape depth, story content, the scoped Zustand illustration stage, and FAQ/protocol sections into small components and CSS modules. `UiProvider` is reused for reduced motion and footer controls without mounting wallet/RPC/market providers. All copy, links and FAQ work before hydration; the diagram is explicitly an illustration, never a live room.

The landscape is a self-hosted, licensed WebP, resized by Next Image with an explicit viewport size and hero preload. Bounded Framer Motion transforms use native document scrolling; text and CTA positions do not animate. The three-stage diagram follows scrolling in both directions. Mobile uses a static-position figure above the readable chapters. Reduced-motion changes disable transforms immediately. See [LANDING_PAGE](LANDING_PAGE.md) for sources and storyboard.

Wallet-adapter CSS and its theme overrides load only from the `/play` layout. Its existing external DM Sans import no longer affects initial landing visits. The shared footer accepts an optional `/play` link on the landing; its existing game return button, visual design and shader remain intact.

New invitations are canonical `/play?room=…` links. Same-origin parsing accepts both `/play` and legacy `/`. The landing server redirects only a single validated legacy room address, dropping unrelated parameters. Invalid or repeated room parameters do not redirect. Local tooling now advertises `http://127.0.0.1:3400/play` and existing game browser checks target `/play`.

## Withdrawal ticket and feedback

`features/claims/withdrawal-state.ts` derives visibility, exact claimable assets and the recovery cutoff from the confirmed base Ledger. A seated player with a settled or closed position sees one withdrawal surface instead of a redundant sell panel above it. A live seller who has already claimed keeps a concise empty-entitlement state. Spectators never receive a claim row; permissionless recovery remains available at the base cutoff.

`withdrawal-ticket.tsx` and its CSS module own the token identity, full-precision amount, vault-to-wallet label, primary claim action and native details disclosure. The component does not route, sign or declare success. `claims.tsx` retains wallet-authorized generated instructions and idempotent destination-ATA creation. WSOL stays wrapped. Footer, official marks, typography and palette are unchanged.

`stores/claim-action-store.ts` provides room/wallet/client-scoped in-flight feedback and a synchronous duplicate-action guard before instruction construction. Its error callback sends failures and cancellations to the shared notification boundary; it stores no inline error string. Late results release their original store. Known pending base operations disable claim controls and point to Check transaction, while the separately journaled recovery action remains independent. The public transaction journal and onchain replay guards remain authoritative, including after reload; this UI store is not a new transaction journal. No local success flag removes balances.

Native disclosure chevrons use 150ms CSS feedback and become instant under reduced motion. Token values and financial hit areas never animate. See UI_DESIGN and TESTING for the reference study, four-browser proof and exact remaining limits.

## Room sharing and current transaction copy

`components/shell/room-invite.tsx` and its CSS module own the invite utility and clipboard-denial field. `stores/room-invite-store.ts` owns room-scoped asynchronous feedback, duplicate-click protection, bounded clipboard waiting and stale-result invalidation. `lib/room-link.ts` validates public room addresses, builds clean `/play` links and parses same-origin links without carrying unrelated URL fields. The join form accepts both links and addresses. These modules never sign, fund, queue a SELL or claim a seat.

The invite control uses a fixed-size 150ms icon/label transition, instant under reduced motion. Keyboard users receive a selected manual field on clipboard denial and focus return on Escape. Narrow screens keep the invite label and an accessible icon-only transaction check. Old accepted-intent notifications now report a historical event, not a current assertion that WSOL remains unsold; the live position and base Ledger remain authoritative.

Interactive local gameplay is available while `bun run local --execute-local` runs on port 3400. Port 3000 remains the read-only preview. See LOCAL_PLAY for synthetic funding, room watch, shutdown, new-genesis semantics and the still-unverified extension-wallet boundary.

## Gameplay observation and token ticket

`room-observation.ts` retains the last confirmed Ledger through transient base errors without resetting its timestamp. ER failures preserve the latest base observation but clear Control, disabling SELL independently of claims/recovery. ER Clock and its observation time are tracked separately from base Clock; `sell-state.ts` applies the client's cohort/admission and full quote-validation rules.

`sell-request.ts` delays preparation until the operation runner holds its wallet guard. Preparation resolves/validates placement, checks quote freshness immediately before signing, then checks again after signing. Submission performs a second fresh placement check. The runner journals the prepared endpoint before broadcast. A known-unsent quote is recorded as not_sent; uncertain submission still blocks new signing until reconciled.

`SellTicket` and its CSS module own the paired token presentation, visible minimum, fee disclosure and refresh/queue controls. They do not quote, sign, route or derive balances. Native segmented controls use a CSS indicator while their hit targets remain fixed. Existing scoped Zustand preferences, Sonner, wallet adapters, exact bigint arithmetic and chart data lifecycle are unchanged. UI_DESIGN records the reference study; TESTING records validation and gaps.

## Current Collect UI arena redesign

`components/shell/arena-workspace.tsx` composes the shared overview, player group, action slot, reference chart and optional history. Both lobby and match use the same responsive layout. The four player positions span desktop width; the former sidebar remains a compact accessible disclosure below 1101px. Actions occupy the first column and precede the chart on mobile without changing source order. Footer and shader modules are unchanged.

Presentation responsibilities remain separate: `standoff` derives headline and bounded clock; `roster` derives player data; `player-seat` renders it; `TokenAmountInput` preserves exact strings; lobby/funding/SELL/claims retain their transaction handlers. `market-panel` owns feed presentation and `market-chart` its imperative canvas lifecycle. The new workspace adds no provider, service, protocol or dependency boundary.

CSS remains split by component responsibility. Palette primitives are unchanged. `tokens.css` introduces arena-only geometry and a pale indigo action face; footer tokens and typography stay fixed. Entry uses a single-rule amount field, presets below and underlined content tabs. The chart has a bounded 200–280px plot; quote details do not stretch the actual canvas. Claims omit zero-entitlement rows but keep permissionless recovery. No fabricated prices, users or financial state are introduced.

Browser tests now assert horizontal desktop player alignment, action/chart top alignment, source-consistent mobile order, an above-fold create action, readable nine-decimal input and the dot-free feed status. Existing wallet, navigation, footer, shader, keyboard, touch, offline, transaction and settlement coverage remains. See TESTING for current results. Older layout descriptions below are historical where they conflict.

## Previous quiet instrument system

The 2026-09-08 quiet instrument revision replaces the Solpot component surfaces described below. `styles/tokens.css` now defines hairline (`--line`, `--line-strong`), faint text and chip radius roles; the contrast-tested role names are unchanged and still resolve to exact primitives. `controls.css` owns flat buttons and the three selector appearances, `token-input.css` the amount field without a symbol badge, and `game.css` the room action card, quote breakdown, claim rows and slim activity strip. `standoff.module.css` owns the flat headline/timer pair.

`components/ui/card.tsx`, `lib/utils.ts` and `components/ui/solana-symbol.tsx` were removed. `navigation.tsx` no longer imports Framer Motion; the pinned package remains installed but unused by application code. `funding.tsx`, `sell.tsx` and `claims.tsx` group their actions into rows and disclosures without changing instruction building, quote handling, journaling or confirmation semantics. Class hooks (`player-rail`, `rail-content`, `player-slot`, `roster-seat`, `market-panel`, `market-canvas`, `standoff`, `room-entry`, `room-controls`, `lobby-section`, `token-input-value`, `entry-modes`, `stake-presets`, `create-action`) and accessible names are preserved for the browser suites. The sections below describe earlier surfaces where they conflict.

## Previous Solpot component system

This component-level revision retains existing game/runtime boundaries. `Button` defaults to native `type="button"`; form submissions explicitly opt in. Funding, claims, recovery, transaction checks, receipt retry and dialog confirmation reuse it alongside lobby/SELL. Its raised primary surface is shared with the wallet adapter. `SegmentedControl` has typed `inset`, `keys` and `tabs` appearances with unchanged controlled-button semantics. `TokenAmountInput` still owns exact text/decimal input; its surface and monochrome SOL glyph are separate modules.

`features/match/player-seat.tsx` separates empty/funded presentation from `roster.tsx` ledger derivation. `player-seat.css` owns the frames; `player-rail.css` retains disclosure layout. Empty seats focus entry without signing. Funded cards show actual identities and nonzero exact assets. `wallet.css` replaces the retired metallic-pill styles and targets `.wallet-control .wallet-adapter-button-trigger`: the pinned adapter overwrites caller-supplied classes.

The exact palette, self-hosted fonts, approved logo, Waves footer, scoped Zustand and Sonner are preserved. Reference charts use 220–280px desktop plots, 180px on short laptops and 168px mobile. Mobile SELL pairs balance and action above the explanation. No dependency, economic or protocol change was required. See UI_DESIGN and TESTING for current direction/evidence; conflicting visual descriptions below are historical.

## Approved logo integration

The split F is now the approved product identity. `components/brand/geometry.ts` supplies the exact two paths to `BrandMark` and `BrandLogo`. The same component is used by header, footer, startup, errors and the 404 page. `styles/brand.css` owns the shared proportions; placement-specific rules remain in navigation/footer styles. The mobile header uses only the mark below 481px while preserving its accessible home label and 44px target.

Static dark/light SVGs are served from `/brand/`. `app/icon.svg`, `app/favicon.ico` and `app/apple-icon.png` follow the installed Next.js file conventions. They are generated from the canonical paths and selected palette by `scripts/generate-brand-assets.mjs`; production builds check for asset drift before compiling. No SVG loader, runtime image service, dependency install or financial behavior change was required. The current footer shader and controls remain intact. See TESTING for current logo-specific browser proof and earlier protocol limits.

## Preserved navigation and shader footer

`components/shell/navigation.tsx` handles desktop/mobile disclosure; `navigation-content.tsx` holds product/resource content. Scoped Zustand state clears on room changes and responsive boundaries. Hidden content is inert; Escape, outside interaction and focus departure dismiss. Wallet selection/connection still uses `BaseWalletMultiButton`, with the shared raised surface and explicit busy disablement.

The footer integrates the user-supplied, zero-dependency 21st.dev Waves WebGL shader through `components/ui/adisyon-shader.tsx`. `lib/shader/waves-program.ts` retains the supplied GLSL; `waves-settings.ts` owns the recipe and drawing budget; `waves-renderer.ts` validates and disposes GPU resources; `shader-surface.ts` owns observers, visibility, timing, reduced motion and context recovery. The React wrapper only owns lifecycle refs/effects. Manual pause lives in provider-scoped Zustand. No new dependency was added.

`footer.tsx` composes centered Flinch × Magicblocks typography, actual documentation links, arena/rules actions and native test-build details. `footer.css` owns full-width, borderless layout and the fallback/scrim. The old column SVG is removed and backed up. The shader is decorative, pointer-transparent, capped at two million pixels/30 draws per second, allocated on intersection and stopped offscreen or in hidden documents. Reduced motion freezes a frame. Compile/allocation failure uses the static background; context loss can recover. Deferred context release supports React's immediate remount cycle.

120 web tests, both type checks, production build and UI run `ui-smoke-1788877359602` pass. This includes four footer widths, real framebuffer changes, keyboard/touch controls, pause/resume, reduced motion, context restoration, simulated document visibility and no-WebGL fallback. No local cross-runtime gameplay round was rerun for this footer-only change. See TESTING and UI_DESIGN.

## Boundaries

Current presentation, 2026-09-08: the compact game layout with Solpot-inspired component construction. A persistent 256px player sidebar above 1100px replaces the old curve; compact layouts have an explicit disclosure. The round overview leads a bounded chart and entry/action area. Raised indigo buttons, framed seats, recessed exact-string amount entry and distinct selector appearances replace silver pills and flat rows. Drafts remain in scoped Zustand, and empty seats only focus entry. The current plot dimensions and module ownership are defined above. No economics or transaction semantics changed.

The old SVG spring renderer has been removed. Explicit open/closed state, a viewport subscription, cleaned-up listeners, inert hidden content, next-frame opening focus and live reduced-motion handling replace hover mechanics. Native CSS handles the short opacity/transform transition. The older implementation descriptions below are historical where they conflict with this paragraph; UI_DESIGN and brand.md describe the current surface.

Next.js App Router with strict TypeScript and React. Zustand owns scoped UI, room observations, transaction display and market stores. Sonner provides supplementary notifications. Client-only wallet/session integration; no private keys or paid RPC secrets in public configuration. One shared generated-IDL client serves web, keeper and tests. No monolithic page containing RPC, economics and UI code.

The user's exact shadow-grey/twilight-indigo/alabaster-grey palette supersedes orange/lavender. The app fills the viewport without an outer frame or width cap and uses normal document scrolling. A round overview with four seat summaries leads the compact 184px reference plot; the aligned right column holds room entry or financial actions. Below 1100px the order is round, actions, chart, with a 176px mobile plot. The curved player drawer expands without moving chart or actions. Summary buttons open details; dotted empty slots in the drawer focus entry without signing or reserving seats. Self-hosted Space Grotesk headings pair with Manrope UI text. Solid panels replace glass effects and unconditional hover scaling. No decorative live dots, invented navigation or fabricated history. Reference SOL/USD remains separate from executable pool quotes. HOLD needs no button. See [design study and sources](UI_DESIGN.md).

## Required states

Funding → preparing MagicBlock → live → sell queued → returning control → executing swap → sold/USDC claimable → claimed. Expired or failed batches return to holding when permitted. Show redelegation pauses while the round timer continues. At cutoff show base recovery and unsold WSOL claimability.

Never show Sold from an ER intent, Received from an oracle mark, or Claimed from a signature alone. Source each display from the responsible runtime. The base Ledger is authoritative for money even while Control is delegated.

## Interaction contract

Before SELL display current WSOL entitlement, exact penalty, estimated pool output, user minimum, slippage, and expiry. Snapshot the minimum in the signed intent. Do not silently lower it after a failure. Explain that a successful exit is irreversible; an expired attempt is not a sale.

Session signer stays in memory. On refresh reconstruct accounts and pending operations; use wallet signing if the session is gone. A lost session must not block claims. Deduplicate clicks by logical nonce, not merely disabled styling.

Results show natural holder, all exited, standoff or recovery; show each asset separately and link the actual base swap/claim evidence. No VRF reveal or fake winner is needed.

Use keyboard focus, adequate contrast and touch targets, reduced motion, tabular amounts, and explicit pending/error text. The validation target is Vitest formatting/state mapping and Playwright one-player/three-bot flow with reload at every handoff. Initial browser coverage reloads after SELL; the broader matrix remains unverified.

## Implemented slice

`apps/web/src/features` separates lobby/funding, match/SELL, claims and proof. `lib` owns public configuration, local resolver, wallet operation reconciliation, session builders and pre-sign simulation. Domain economics remain in Rust; the shared client supplies quote computation and IDL builders. No application module imports test fixtures.

The brand, frontend and motion skills guided palette mapping, disclosure, focus, touch targets and reduced motion. The palette is an explicit user selection, so no separate picker was needed. Rules use a native dialog with boundary focus wrapping, Escape dismissal and trigger-focus return. Twenty-five token-contrast cases and three exact primitive-scale tests cover the selected palette; this is not a full accessibility audit.

Framer Motion 13.2.0 is pinned, checked for React 19 compatibility and installed with scripts disabled. A shared spring drives the rail outline and SVG content clip; text uses transform/opacity. A pure reducer separates transient hover from explicit opening in the provider-scoped Zustand store. Hidden content is inert. The provider subscribes to reduced-motion changes and removes the listener on disposal; do not use the pinned library's mount-only preference snapshot for live system changes.

Next.js 16.3.4, React/React DOM 19.2.8, wallet-adapter React 0.15.39/UI 0.9.39, Tailwind/PostCSS 4.3.3, Vitest 5.0.0, Playwright 1.63.0 and React types 19.2.18/19.2.7 were checked against registry metadata and pinned on 2026-09-06 IST. Bun installed with scripts disabled. The GUM SDK pin remains 3.0.10. Build/runtime imports use the browser-compatible Anchor namespace. See SECURITY for dependency advisories rather than assuming latest means safe.

The frontend retains exact pins for Zustand 5.0.15, Sonner 2.0.8, Lightweight Charts 5.2.1 and Lucide React 1.41.0. Fontsource variable Manrope and Space Grotesk were registry-checked and installed at exact 5.3.0 pins with lifecycle scripts disabled. `next/font/local` loads their Latin variable WOFF2 files, with OFL notices under `public/licenses`. Browser assertions verify the actual font faces loaded. DynaPuff/DM Sans remain removed; no SF files are redistributed.

## Module ownership

```text
src/app/                  route/layout composition and fixed-source market history endpoint
src/components/shell/     header, explicit player disclosure, shader footer and rules dialog
src/providers/            per-provider Zustand ownership
src/stores/               UI preferences and wallet-scoped transaction display
src/features/lobby/       room creation, invite entry and funding
src/features/market/      validation, observations, stream lifecycle and canvas renderer
src/features/match/       account observations, detailed roster, scoped round-overview composition and quoted SELL
src/features/claims/      base-layer withdrawals
src/features/proof/       confirmed receipts and transaction evidence
src/lib/                  configuration, sessions, signing, journal and notifications
src/styles/               palette, tokens, shared controls, token input, wallet, player seats/rail, market, lobby and game
```

Store factories isolate providers and wallets. Room addresses remain URL-shareable. Narrow selectors keep market updates out of wallet and game renders; Lightweight Charts subscribes imperatively and batches drawing per animation frame. React effects still own subscriptions and cleanup, and local component state remains appropriate for lifecycle-owned objects and errors. No secrets enter Zustand persistence or browser storage. The public transaction journal remains separate from UI state.

Room creation and invite entry remain separate modules with shared typed props; shell composition does not own signing logic. Player rows omit zero asset lines rather than presenting empty financial furniture. Withdrawal is absent during a live position with nothing claimable, but remains visible for confirmed entitlements, terminal/cancelled seated users and permissionless recovery. Non-funding session controls are expandable. Activity and settlement history remain conditional. No accounting or protocol rules changed.

## Market data

The chart uses Coinbase Exchange public SOL-USD history and ticker/heartbeat WebSocket data. It is explicitly offchain reference information, not a verified MagicBlock oracle feed or an executable devnet pool quote. Candle/line and 1m/5m controls are available. Live candles contain received observations and can be incomplete; gaps are not fabricated. TradingView attribution remains visible and detailed source limitations are expandable.

The fixed upstream history endpoint has a five-second timeout, in-process request coalescing and a ten-second successful cache. The browser validates prices, OHLC ranges, timestamps and sequences, bounds history to 360 candles, reconnects with capped backoff and refreshes history after a gap. Hidden/offline tabs pause the feed; stale data remains visibly labeled. Chart outages do not block funding, recovery or claims. Chart-only floating point never enters token arithmetic.

The history cache is per process, not distributed. No high-concurrency load test, market-data service SLA or complete exchange-quality candle reconstruction is claimed. A public high-traffic deployment still needs provider quota review and measured shared fan-out/caching capacity.

## Run and configuration

`bun run web` starts a loopback-only preview. The default config is devnet/read-only with no pool or validator, so funding/creation/SELL/claims cannot submit. See `apps/web/.env.example` for public fields. Do not put RPC API keys, wallet keys or credentials into any NEXT_PUBLIC field.

Local browser integration sets an explicit local genesis, base endpoint, ER endpoint, fixture pool and validator only in its child process. The local resolver verifies the actual base delegation record; the shared client verifies ER identity and both base/ER snapshots. Hosted devnet uses the router-returned FQDN. This local configuration does not claim to exercise the hosted router.

Enabling devnet writes still requires the user's separate deployment/funding authorization. The flag is a UX default, not an onchain security boundary. A running keeper is required to settle batches; the app is not a hosted keeper service.

## Signing and refresh

Wallet-backed base actions simulate before requesting signatures. A signature prompt is not transaction success. Public journal identity is persisted before send; failure to persist prevents submission. Web Locks serialize cooperating tabs. Unknown transactions remain pending and are reconciled before signing again. Recovery has a separate base journal so an unknown SELL cannot block it. Clearing browser storage loses this offchain record; onchain authorization/replay rules remain required.

The journal stores the last operation per wallet/network/room/runtime, with a separate recovery slot; it is not a full historical archive or distributed lock. Check transaction restores status after reload. Receipt proof independently reads confirmed base receipts, validates their identities/allocations and reconciles aggregate inputs/outputs against Ledger totals.

Joining wraps the exact stake and can atomically create/bind a ten-minute session. Session top-up is the queried zero-data-account rent exemption plus 100,000 lamports for fees; session-token account rent is additional. This is not a session spending allowance. Session secrets stay in memory. After reload, wallet mode remains and the public bound signer allows deriving/revoking the session token through the pinned SDK. A base revocation confirmation does not prove immediate ER revocation visibility.

SELL presents an estimate range, maximum game penalty, immutable positive minimum, 1% slippage and two-second expiry. After signing, expired quotes are rejected before send and marked `not_sent`; unknown network outcomes remain pending. Wallet approval can outlast the quote, requiring an explicit refresh. Sessions are the intended low-friction path. No quote is silently lowered or re-signed.

The Coinbase reference chart is implemented; verified MagicBlock oracle display remains unimplemented. No fake price or fallback fill is displayed. Full fee/rent estimation before every wallet approval, hosted-service error translation and stronger cross-tab/reconnect testing remain improvements before release.

## Frontend verification

Run `bun run --cwd apps/web test`, `bun run --cwd apps/web typecheck` and `bun run --cwd apps/web build`. Serve the production build with `bun run --cwd apps/web start`, then run `bun run test:browser:ui` with an existing Chromium executable when required. The UI smoke uses the actual public feed and an explicitly injected outage, so successful live-feed checks require Coinbase connectivity. `bun run test:browser:stack` separately validates wallet/session/game transactions against local validators. See [retained evidence and limits](TESTING.md).
