# FLINCH interface design

## Reference chart, 2026-09-11

The follow-up explicitly requests a near-black trading-platform plot and rejects the blue gradient. Candles default on and volume off. A native selector contains five meaningful representations rather than a row of tiny icon buttons; 1m, 2m and 5m stay directly accessible. The selector collapses to its icon/chevron on narrow panels, preserving its accessible name and selected option. No unverified interpretation of the user's ambiguous "Daria" reference is claimed.

| Before | After |
| --- | --- |
| Blue line and blue area gradient | Silver unfilled line or a separate neutral Mountain view |
| One/five-minute controls and two chart styles | One/two/five-minute controls and five native styles |
| Volume takes plot space by default | Clean candle plot, optional volume in the footer |
| History refresh jumps back to latest | Historical timestamp stays in place while retained |

Smoothness means frame-batched real updates and stable viewport state, not made-up intermediate prices. Source copy explicitly distinguishes actual Coinbase trades from Solana onchain data, the MagicBlock oracle and Raydium execution. The existing action-first desktop/mobile alignment remains.

The user explicitly chose [KLineCharts](https://klinecharts.com/en-US/). Its official guide and 10.0.3 API informed the integration. The frontend design skill guided these changes without adding a trading dashboard or game mechanic.

| Before | After |
| --- | --- |
| Oversized heading and independently sized panels | Compact market header and shared desktop top/bottom edges |
| Line default and maximize icon used for reset | Native candles, observed volume, separate reset and fullscreen |
| Responsive controls and exact input need alignment checks | Single-row 40px controls and readable nine-decimal input at 320–1920px |

See [CHART](CHART.md) for data semantics, ownership and validation. No footer or landing code was edited by the chart task.

## Storytelling landing, 2026-09-09

The supplied Fora reference informed a full-width photographic hero, generous editorial pacing, restrained typography and simple CTAs. The original FLINCH story is four equal stakes → a successful seller pays holders → the final holder retains their entitlement. A sticky, explicitly labeled illustration changes with scroll; it never fabricates a live round, quote or price chart. The self-hosted landscape is Sergey Pesterev's licensed Unsplash photograph, not Fora artwork. Source details and the motion storyboard are in [LANDING_PAGE](LANDING_PAGE.md).

Design-taste guided spacious asymmetry and concise product copy. Frontend-design-guidelines and page-load-animations guided scoped components, immediate server-rendered content, native links/disclosures, bounded spring motion and live reduced-motion handling. The existing fonts, palette, marks and approved shader-footer styling remain. No new dependencies or third-party component code were installed.

Desktop/mobile screenshots were reviewed. A pixel-sampled background check exposed insufficient contrast for the small mobile test-build label; alabaster-100 now passes with a minimum sampled ratio of 4.83. The contrast scope is hero text at 375/1280px, not a full accessibility certification. Native scrolling remains under user control. Chromium checks cover 320–1920px, forward/reverse story stages, keyboard/rules/FAQ, no-JavaScript content, landing-to-arena navigation and legacy invitations. TESTING retains final evidence and limits.

## Withdrawal refinement, 2026-09-09

Revisited the live [Collect UI E-Wallet gallery](https://collectui.com/designs/e-wallet-ui-design-inspiration) and [Skiper Aave token swap preview](https://skiper-ui.com/v1/skiper22). The useful patterns are the strong amount hierarchy, compact token identity and a single obvious action. The Skiper preview is Pro; no protected source, assets, number-animation package or other dependency was copied or installed.

Direction: refined charcoal withdrawal ticket. Density: comfortable. Surface: a quiet token field inside the existing action panel. Type mood: geometric, tabular, concise. Motion: short disclosure/control feedback only. Preserve the exact palette, Space Grotesk/Manrope, official marks, split F and full-width shader footer. Avoid success confetti, idle motion, repeated exit headings, interpolated balances and generic status dots.

| Before | After |
| --- | --- |
| Exit confirmed panel followed by a second withdrawal panel | One post-sale action surface sourced from confirmed base entitlements |
| Small monospace amount and outlined claim action | Full-precision display amount and a full-width primary claim action |
| Rent/wrapped-token explanation always visible | Native keyboard-accessible details below the action |
| No local acknowledgement during instruction preparation | Scoped in-flight feedback and duplicate-action exclusion |
| Live seller's withdrawal section disappears after claiming | Concise zero-entitlement state; no promise based on a signature |

The vault-to-wallet row names the fixed transfer direction, not a configurable destination. Wrapped SOL and test USDC keep separate exact amounts. The claim handler still uses the wallet-owned ATA and existing operation runner. Known uncertain base actions disable further claims but do not disable separately journaled recovery. Confirmation comes from the base Ledger; accepting SELL on MagicBlock still cannot produce this ticket.

The design-taste and frontend-design-guidelines skills guided hierarchy, bounded surfaces, native disclosure, focus and token-preserving motion. Chevron feedback takes 150ms; reduced motion removes it. No financial amount, hit area or departing transaction form is animated. Browser proof covers 375/768/1280px withdrawal layout, wallet rejection without signing, and a real claim during an injected ER read failure. TESTING records exact evidence and limits.

## Room invitations, 2026-09-09

The [Collect UI Invite gallery](https://collectui.com/designs/invite-ui-design-inspiration) was inspected live. Its compact link fields, quiet copy affordances and clear action hierarchy informed this focused addition. No gallery code, paid component source, new assets or package was copied.

Direction: comfortable charcoal game room; a toolbar utility rather than another card. Type: geometric, compact, sentence case. Use the existing fonts, palette and secondary control geometry. Keep SELL and claims visually primary; preserve the approved footer. No decorative participant counts, invitations that promise seats, referral mechanics or extra banner copy.

`RoomInvite` uses a room-scoped Zustand store. The fixed button cross-fades its link/check icon and label over 150ms, without moving its hit area or nearby controls. Reduced motion removes transitions. Copy feedback appears only after the browser confirms the clipboard write. Denial or a five-second clipboard timeout reveals a labeled, selectable link, with keyboard Escape and focus return. Room change/unmount invalidates old async feedback. No signing or network request is part of sharing.

Shared URLs contain only the current origin, root path and validated public room address; existing query values, hashes and URL credentials are not copied. The lobby accepts the same-origin invite or raw address, extracts only the room, and still requires a separate explicit stake approval. Mobile retains a labeled invite action and moves transaction checking to its named 44px icon. See TESTING for responsive, clipboard and actual four-player join evidence.

Visual review of the first four-browser run exposed stale notification copy: a confirmed sale appeared alongside the earlier intent toast saying WSOL had not sold yet. Intent notifications now describe the historical acceptance and point to the position for current sale status. They neither declare a sale nor claim that a later-confirmed sale is still pending. Base notifications no longer refer to balances “below” a panel that is actually above them. This changes copy only; the base-ledger settlement authority is unchanged.

## Token-ticket refinement, 2026-09-08

Direction: refined charcoal game instrument. Density: comfortable, action-first. Surfaces: one room panel with paired token fields; quiet filled seats rather than identical framed cards. Type mood: geometric, tabular, concise. Motion: interruptible selector movement, no bounce or financial-value interpolation.

Do: preserve official token identities, show the exact WSOL entitlement and signed USDC minimum, group quote fees behind a native disclosure, keep controls in fixed hit areas and preserve the footer. Do not: animate quoted numbers, extend quote validity, delay signing controls for an entrance, imitate a full exchange or add decorative activity.

Additional references inspected live:

- [Collect UI E-Wallet gallery](https://collectui.com/designs/e-wallet-ui-design-inspiration): token identity, quiet container edges and distinct amount/metadata hierarchy.
- [Jeet's Savings Vault](https://x.com/jeetnirnejak/status/2088619488682102849), opened in the gallery: a single purpose-built instrument, restrained header and compact action. Its combination-lock animation is not copied into the game.
- [Collect UI Analytics Chart gallery](https://collectui.com/designs/analytics-chart-ui-design-inspiration): compact finance plots, prominent values and subordinate controls. The reference chart remains real, unsmoothed market observations, not game proceeds.
- [Skiper Aave token swap](https://skiper-ui.com/v1/skiper22): public preview inspected. Paired send/receive fields, token marks and a single action informed the sell ticket. The component is Pro; no paid source, registry code, number-flow dependency or assets were copied. The page credits Family and Jakub for its inspiration.

The new `SellTicket` is original code using the existing Button and official EcosystemIcon components. It separates presentation from SELL preparation, eligibility and submission. Missing quotes display no USDC estimate. A fresh quote never overrides deployment, wallet, busy or placement checks. Refresh is read-only, never automatic signing.

Motion storyboard: selection changes immediately; the selector background or underline travels to the selected control over 220ms; hover and disclosure-chevron feedback take 100–150ms. All controls remain in place throughout. Reduced motion makes every transition instant. Funding/claim/SELL amounts snap directly to observed values. No financial form is retained for an exit animation. Existing footer motion is untouched.

The page-load-animations skill supports using CSS for these small transitions; no Framer dependency is needed for a moving indicator. The repository's no-comment rule places this storyboard here rather than in code. Earlier visual descriptions below are historical where they conflict.

## Current Collect UI arena redesign, 2026-09-08

The user requested a complete frontend redesign and explicitly asked to keep the footer. The actual current preview and source were inspected before editing; the starting point was the quiet instrument revision, not the older Solpot implementation. Source, tests and current design docs are recoverable from `artifacts/runs/design-before-collect-zAanCY/frontend.tar`.

### Design brief

Direction: charcoal game table, not a general trading dashboard. Density: comfortable. Surfaces: two principal panels, numbered seat positions and quiet dividers. Type: geometric, tabular, restrained. Motion: short feedback, no idle animation outside the preserved footer.

Do: put the next action before the reference chart; group the four players; distinguish empty seats from real positions; use a single pale primary action face; let amount typography carry the entry panel. Avoid: repeated rules blocks, stacked borders and shadows, decorative live dots, fake activity and another permanently empty sidebar.

### References inspected live

- [Collect UI dashboard gallery](https://collectui.com/designs/dashboard-ui-design-inspiration): compared compact instruments, finance panels and multi-pane compositions.
- [Dashboard Analytics UI by Gabriel](https://collectui.com/designs/dashboard-ui-design-inspiration/ed8312a0-c221-41f8-8fe7-f839b2205260): distinct label/value scale, bounded chart, contextual action area and generous internal spacing. Adapted to a dark game interface; no finance-dashboard features or assets copied.
- [Crypto dashboard by rico](https://collectui.com/designs/dashboard-ui-design-inspiration/46db3d00-1345-407f-b031-b19326d5fd49): restrained chart strokes, understated controls, tabular amounts and clear secondary information. No referral features or third-party implementation copied.
- [Collect UI button gallery](https://collectui.com/designs/button-ui-design-inspiration): studied stateful buttons, focused labels and directional action cues. Its more ornamental glass/glow treatments were not appropriate for repeated financial actions.

Collect UI is visual reference material, not an installed component package. No new dependencies, copied assets or registry snippets were required.

| Before | After |
| --- | --- |
| Permanent 256px sidebar and repeated rules | Four desktop seat positions spanning the arena; compact explicit disclosure on smaller screens |
| Chart followed by a wide form | Focused action column before the reference chart, with matching top edges |
| Indigo action face with an inset sheen | Pale indigo face, dark label, no stacked rims; clear disabled treatment |
| Full-width recessed amount box | Large exact-string value, one bottom edge, presets below |
| One crowded chart-header row | Pair, value and controls with separate spacing and calmer plot margins |
| Repeated player count and explanatory blocks | One visible membership count; rules on demand; only nonzero claim rows |
| Small headline and plain timer | Sentence-case display heading with bounded, explicitly estimated round time |

The full-width Waves footer, its controls, typography and shader implementation are preserved. Header/footer logo geometry and the palette are byte-identical to the source backup. Financial writes still use the existing handlers and generated client; SELL intent acceptance never means a completed swap. See TESTING for final evidence and limits.

## Previous quiet instrument revision, 2026-09-08

The user reviewed the Solpot revision and called everything except the footer sloppy. Screenshots of the lobby, funding, live, queued, claimable and terminal states confirmed the problems: uniform bezelled boxes, muddy grey casts, duplicated rules copy, misaligned stat cards and form columns, and an italic uppercase headline. This revision keeps the footer, logo, palette primitives, fonts, game semantics and every tested label, and replaces the component and layout system.

| Before | Now |
| --- | --- |
| Bezel, rim and inset sheen on seats, stats, chart, entry, buttons and selectors | One raised surface for cards; hairline dividers; flat controls; shadows only on floating layers |
| Four greys with different casts | Canvas 950, card 900, raised 800, hairlines in alpha |
| Italic uppercase headline with a filler eyebrow | Sentence-case Space Grotesk headline; the eyebrow names the phase |
| Players and timer in two bordered boxes | Flat stat pair aligned to the headline baseline |
| Four 92px seat cards plus Hold/Sell prose and a "powered by" line | 52px seat rows, compact rules list, one help link |
| Token badge, vertical rule and three bezelled control groups in the chart header | One row: pair, price, change, flat segments |
| Two-column entry grid with the action out of line with the input | One column: label and chips, amount, facts beside the action |
| Session paragraph, three mixed-size buttons and keeper copy before the join action | Join first, session toggle with an on-demand explanation, secondary actions grouped |
| Withdraw as two inset boxes | Asset rows with inline claim actions |

Module changes: `card.tsx`, `utils.ts` and `solana-symbol.tsx` were unused or decorative and were removed. `navigation.tsx` drops Framer Motion for a CSS transition. `funding.tsx`, `sell.tsx` and `claims.tsx` extract their handlers and group actions; no signing, quoting, journal or claim logic changed. `standoff.tsx` adds a phase eyebrow and a timer state attribute. Hook class names and accessible names used by the browser suites are unchanged.

Design-taste guided the single-surface hierarchy and the removal of repeated copy; frontend-design-guidelines guided control sizes, focus, contrast and reduced motion. Visual acceptance remains with the user. See TESTING for this revision's evidence.

## Previous Solpot-inspired components, 2026-09-08

Reference: the user's 20:07 screenshot and [Solpot](https://solpot.com), visually inspected live. Useful details are layered control edges, recessed amount fields, heavyweight numerals and framed player identities. No jackpot/reel mechanics, chat, promotions, branding, user avatars or third-party implementation were copied.

Direction: compact dark game interface, charcoal panels, one indigo action accent, strong display typography and short press feedback. Preserve the split F and borderless Waves footer.

| Before | Now |
| --- | --- |
| Metallic wallet pill and silver submits | Shared raised indigo faces, inset highlights, charcoal rims and explicit disabled surfaces |
| Right-aligned amount with a bottom-only edge | Large left-aligned exact-string field, recessed full boundary and SOL identity |
| One selector treatment everywhere | Recessed chart segments, raised preset keys and underlined entry tabs |
| Flat rows with dotted lower edges | Dotted empty seats; framed real positions with seat badge, accent lip and asset compartment |
| Small uniform round text | Italic display title and framed estimated clock |
| Uniform chart surface | Instrument header, indigo real-data plot and separate source footer |

`player-seat.tsx` only presents supplied data; `roster.tsx` retains ledger-derived membership and exact amounts. Shared controls stay in `components/ui`; styles are split into controls, token input, wallet, player seats, player rail, market and lobby responsibilities. The pinned adapter replaces custom class names, so the wallet uses its actual trigger selector. No dependency was added.

Financial states remain unchanged: queued is not sold, and reference prices are not executable quotes. Narrow active rooms pair the balance and quote button before explanatory copy. The complete local test checks funding, active, queued, claimable and terminal screens. The current production UI suite also checks the preserved logo and real shader.

The design-taste and frontend-design-guidelines skills guided hierarchy, contrast, keyboard/touch behavior and motion restraint. Screenshot direction justifies deliberate layered edges; no decorative arena background gradient or continuous control animation was added. Retired source is backed up at `artifacts/runs/design-before-solpot-40FxWW/frontend.tar`. See TESTING for evidence and remaining release gates.

## Current full-width shader footer, 2026-09-08

The latest request replaces the bordered column composition with the actual supplied 21st.dev Shader Builder Waves shader. The footer reaches both viewport edges with zero margin, border or radius. A dark fade joins it to the arena. Centered Space Grotesk “Flinch × Magicblocks” is the focal point; mobile stacks the names. Supporting Manrope text and edge-aligned utilities remain separate from the wordmarks. There are no invented social accounts or official-partnership claims.

The shader source and four-color recipe come from the user's `ba4985b4-108d-4253-9e46-5eb9a1043043/pasted-text.txt` attachment. Its rendering algorithm is retained, with separate resource/lifecycle modules for validation, cleanup, visibility and motion policy. Pointer interaction remains disabled as supplied. A static CSS background covers initialization, WebGL failure and context loss. The contrast scrim is tested against white, the brightest possible shader output. No third-party runtime dependency or font was installed; all 33 selected primitive colors remain unchanged.

Production evidence: `artifacts/runs/ui-smoke-1788877359602/result.json`, including four-width screenshots and `footer-reduced-motion.png`/`footer-no-webgl.png`. Real framebuffer variation, animation controls, recovery, disclosure and keyboard tests pass. The frontend-design guidelines shaped contrast, native controls, responsive behavior and reduced motion. Device-wide GPU performance, Safari/Firefox and real iOS hardware remain unverified; this is not a claim of identical rendering everywhere. The prior column version is retained in `artifacts/runs/footer-before-shader-yKkoEY/source.tar.gz`.

## Previous column footer reference, 2026-09-08 evening

The user explicitly requested the supplied Sui footer screenshot's composition. This supersedes the compact editorial footer described below. The new footer has seven symmetrical columns with soft black-to-blue fades, static grain, six dotted vertical dividers and a pale lower edge. Small monospaced FLINCH credit and four square controls occupy the upper left. No oversized lettering, headline or card grid remains.

`footer-artwork.tsx` owns the decorative SVG; `footer.tsx` owns actual protocol links, arena/rules actions and native test-build details. `footer.css` controls responsive containment. The screenshot's social accounts and Sui copyright were not copied. Functional protocol/arena links replace them until actual FLINCH profiles exist. The black/electric-blue artwork has explicitly scoped semantic tokens documented in brand.md; the app's 33 primitives and financial behavior are unchanged.

The grain is a deterministic alpha-only dark overlay, not a desaturating blend over the colors. Divider gradients use user-space coordinates so zero-width paths paint correctly. SVG IDs are instance-scoped with useId. At compact widths, the artwork anchors below the readable controls; all seven columns remain. No WebGL, animation, dependency or external asset request is needed.

Final production evidence is `ui-smoke-1788875784875`; four footer widths, disclosures, touch targets, keyboard behavior, navigation/wallet and existing UI recovery checks pass. Desktop/tablet/mobile screenshots were reviewed. This is a screenshot-based recreation, not a pixel-identity claim or a gameplay deployment.

## Earlier header, wallet and footer, 2026-09-08

The supplied component prompts are references, not instructions to add their unrelated landing page, xAI branding, stock images or placeholder routes. The existing Next/Tailwind/TypeScript stack and `src/components/ui` structure support this integration.

| Reference | FLINCH adaptation |
| --- | --- |
| Liquid-metal button | Dark control with a metallic rim, readable label and native focus; standard wallet adapter underneath |
| Notched navbar | Centered dark notch, compact labels, game/protocol disclosures and explicit mobile navigation |
| Blue atmosphere/Sui columns | Removed after screenshot feedback; indigo is now restrained to labels and interaction emphasis |
| Baggy/Bouquet lettering | Replaced oversized cropped lettering with a compact wordmark and project credit |

`navigation.tsx` owns disclosure, `navigation-content.tsx` owns content, and scoped Zustand owns state. `wallet-control.tsx` preserves the adapter and adds labels/busy presentation. `footer.tsx` owns information/actions; its styles remain isolated in `footer.css`. The rejected decorative SVG component and its unused tokens were removed. No financial code changed.

Registry verification failed under restricted DNS; escalation failed because the approval service returned a missing-deployment 404. The Paper shader is not installed. Local CSS provides an explicitly approximate rim, without WebGL, runtime style injection, timers or new packages.

Motion storyboard: navigation opens over 200ms with opacity and a six-pixel offset; dismissal makes it inert immediately and fades within 150ms. Mobile follows the same timing without moving the chart. Reduced motion removes interpolation. The metal rim is static until hover/focus, then rotates a CSS gradient over three seconds; continuous rotation deliberately uses linear timing. Balances and financial-control positions do not animate. Footer controls use existing hover/focus feedback, with no entrance or decorative animation. This documentation replaces code comments.

The screenshot-led footer fix uses a flat section, a 1280px inner reading width, aligned game/resource columns, a dedicated network/fee notice and a small bottom signature. No oversized artwork, cropped lettering or enclosing card remains. Mobile stacks the introduction above two compact link columns without hiding disclosures. The production preview was rebuilt on port 3000. Browser run `ui-smoke-1788816482543` verifies four footer widths, unclipped lettering, touch targets, keyboard focus, rules and return actions; desktop/tablet/mobile screenshots were reviewed. See TESTING for broader limits.

## Previous terminal and component system, 2026-09-08

The user requested a Rugs.fun-style frontend with FLINCH's underlying game, then clarified with a Trove screenshot that rearranging panels without redesigning components was insufficient. The screenshot is visual reference only. No Trove/V7 implementation was read or copied. This section supersedes the historical iterations below.

Direction: compact dark game terminal. Rugs supplies the chart/control hierarchy; ORE supplies restraint; the screenshot supplies low-contrast filled surfaces, monospaced amounts, inset controls and silver actions. Keep real observations and exact selected palette primitives. Do not add chat, clans, mining tiles, multipliers, fake history or prediction mechanics.

| Reference inspected live | Useful evidence and scope |
| --- | --- |
| [Rugs.fun](https://rugs.fun) | Dominant chart, controls below, secondary information on the left; crash mechanics and branded artwork are not copied. |
| [ORE](https://ore.com) | `ore.supply` redirects here. Restrained typography, shallow surfaces and direct amount entry; mining is not FLINCH gameplay. |
| [Hyperliquid](https://app.hyperliquid.xyz/trade) | Shared chart/control alignment; adjacent trading reference, not the same game. |
| [Jupiter](https://jup.ag) | Inset amount groups, currency labels and one clear submit action; no Jupiter routing added. |
| [Kamino](https://kamino.com/earn/lend) | Quiet contained surfaces and row hierarchy; lending is not in scope. |
| [Axiom](https://axiom.trade) | Landing/sign-up surface observed; the authenticated trading UI was not inspected. |

These are selected product references, not a measured popularity ranking or security endorsement. Their code/assets are not dependencies.

| Before | After |
| --- | --- |
| Rectangular outlined amount input | Reusable inset token field, currency pill, right-aligned monospace amount and presets |
| Blue and outlined actions | Silver primary controls, filled secondary controls and rounded submit actions |
| Separate chart/preset implementations | Typed segmented selector shared by chart, presets and entry mode |
| Strong grid and dashboard framing | Monochrome area default, optional candles, horizontal-only grid and subdued edges |
| Duplicate seat summaries and curved hover sidebar | One player list with persistent desktop and explicit compact disclosure |
| Duplicated creation/invite forms | Mode-switching entry dock preserving drafts and concise copy |

`controls.css` owns shared control treatments. Shell, player list, market, lobby and game styles remain separate. `TokenAmountInput` requires a labeled ID and preserves exact strings. `SegmentedControl` uses non-submit buttons and pressed states. Signing, quote expiry, routing and claims are unchanged. The neutral area fill does not create synthetic prices or payouts.

Design-taste guided direction and frontend-design-guidelines guided components, contrast, focus and motion restraint. The unreferenced SVG spring renderer was removed, not retained as a second design system. The previous source is backed up in `artifacts/runs/design-before-terminal-5vxbmc/frontend.tar`. No dependency was installed.

Iteration checks caught compact-opening focus timing and a below-fold intermediate-width action. Focus now waits a frame; the player disclosure breakpoint is 1100px. Local game tests then caught below-fold mobile quote access; the quote action was placed immediately after the entitlement, before explanatory text. Full quote/fee/minimum information still precedes the signed SELL. Final evidence and limitations are in TESTING.

## Historical game-table composition, 2026-09-07

The latest request is a substantial composition and component redesign inspired by Collect UI. Preserve the user-selected grey/indigo palette and local fonts. Visual acceptance belongs to the user; passing tests is not a claim of perfect design.

Direction: dark, precise game table. Comfortable information density, compact controls. Solid graphite surfaces, editorial display type, restrained indigo selection, interruptible drawer motion. No generic KPI grid, ornamental live dots, glass layers, fake players or moving financial panels.

| Inspected reference | Applied decision |
| --- | --- |
| [Taras's dark Mac app](https://collectui.com/designs/mac-app-ui-design-inspiration/b9088f56-34ad-4c95-a4aa-5301633eab3b) | Group related controls into one surface; distinguish titles, rows and inset inputs with spacing rather than heavy effects |
| [Rachit Thakur's cards](https://collectui.com/designs/card-ui-design-inspiration/6a743686-ab18-4c04-a83d-619f58702975) | Consistent ordinal anchors, clear separation between primary content and supporting explanation, restrained use of accent |
| [Collect UI Mac App gallery](https://collectui.com/designs/mac-app-ui-design-inspiration) | Receding application chrome, aligned panels and compact utility controls |

These are visual references, not component dependencies. No third-party implementation, artwork or assets were copied, and their component-code licenses were not assumed.

`features/match/standoff.tsx` and its CSS module own the round overview: bounded estimated timer, filled-seat count and four actual seat summaries. Lobby slots are honestly empty. Timers show duration before a round and stop on cancellation or terminal state. A queued intent remains distinct from a confirmed sale. The existing detailed roster remains in the curved drawer. No chart value enters game accounting.

Desktop layout places the overview above a compact chart, with a dedicated entry/position column on the right. Mobile orders overview, actions, then reference chart, retaining all players. `styles/lobby.css` owns this composition and form treatment; shell, rail, market and game styles retain separate responsibilities. New controls share a typed, native button primitive with CSS feedback instead of unconditional Framer scaling.

The current entitlement is prominent in the SELL panel. Single-host Sonner notifications are positioned near the top; a browser hit-test checks that the initial SELL action is not covered by another surface. Exact quote, minimum, expiry and confirmation behavior is unchanged.

The existing spring silhouette is retained. Hidden content is both inert and hidden from accessibility navigation. Explicit close restores focus only after the trigger becomes focusable. Dismissed hover cannot reopen beneath a stationary pointer after rules close. Reduced motion remains a live scoped preference. New seat-summary buttons only open details; drawer empty-seat buttons only focus entry.

The design-taste, frontend-design-guidelines and page-load-animations skills informed hierarchy, no-comment motion documentation, coherent controls, touch/focus behavior and an anti-slop review. No dependencies or skills were installed. Before this pass, 17 existing checks failed due to token/disclosure drift; those were reproduced before editing. The initial source snapshot is retained in `artifacts/runs/design-before-table-WoUQGS/frontend.tar`.

See [TESTING.md](TESTING.md) for final retained evidence and explicit limits. The following sections are historical iterations, not instructions to restore older layouts.

## Historical fullscreen grey/indigo layout, 2026-09-06

The latest user request replaces orange/lavender with all 33 supplied shadow-grey, twilight-indigo and alabaster-grey primitives. `brand.md` is the current source of truth. The user asked for a full-screen application and shorter boxed charts; visual acceptance remains with the user.

| Before | After |
| --- | --- |
| 1440px maximum-width window, outer margins and rounded frame | Edge-to-edge shell, no maximum width, minimum 100dvh and footer after the main content |
| Reference chart attached to the main canvas | Bordered 16px-radius panel, 184px plot on desktop and 176px plot on compact screens |
| Desktop creation and invite forms below the chart | 360px entry panel beside the chart above 1100px; stacked layout on narrower screens |
| Orange actions and lavender surfaces | Shadow-grey surfaces, alabaster text, indigo actions and selection |
| System-only typography | Self-hosted Space Grotesk headings and Manrope UI, tabular numbers and monospace exact units |

Primary actions use indigo 600, not 500: alabaster labels on 500 measure only 4.46:1. A lighter indigo edge identifies enabled controls; line-chart strokes use the lighter shade too. Twenty-five contrast pairs and all exact primitives are tested. No primitive is modified to satisfy contrast, and no light theme is introduced.

The brand-design skill guided semantic color mapping, backups and licensed self-hosting; frontend-design-guidelines guided layout, readable contrast and touch targets. Both Fontsource variable packages were registry-checked at 5.3.0, installed with scripts disabled and loaded using the installed Next font guide. OFL notices are served under `public/licenses`. The prior theme is retained in `artifacts/runs/theme-before-fullscreen-V0CWci/`.

The player-rail interaction below is preserved. Active financial controls still precede the reference chart; the fullscreen layout does not change custody, sessions, quotes, game rules or confirmation handling. Browser checks verify six widths from 375 to 1920px, full-width/full-height geometry, boxed compact plots, actual loaded font faces, no horizontal overflow, and existing rail/focus/outage interactions. Current evidence is in [TESTING.md](TESTING.md).

## Preserved player rail and historical orange palette, 2026-09-06

The previous user request supplied 33 exact orange, dusty-lavender and blue primitives plus an Excalidraw silhouette. That palette is now superseded by the fullscreen revision above. The silhouette and interaction contract remain current.

That iteration used a continuous canvas, dusty-lavender surfaces, orange actions, a blue scale named `black` for focus and native SF/system typography. Real chart observations, scoped Zustand and Sonner remain; color and typography are governed by the latest section. Dark-only rendering remains intentional.

### Motion storyboard

```text
Rest          80px curved edge; four compact slot marks and a player count
Pointer enter spring begins immediately; edge grows to 280px
During motion shared SVG clip reveals slot content only inside the moving edge
Settled       dotted Player 1–4 entry buttons, or actual funded player state
Pointer leave hover-only opening reverses from its current spring position
Click / Enter explicit disclosure stays open while interacting inside it
Escape / out  close immediately begins; keyboard dismissal returns trigger focus
Reduced       no spatial interpolation or fade; jump to the requested state
```

Spring stiffness 300, damping 32, mass 0.8. Content offset is 16px with a 150ms opacity transition. No page-load choreography, stagger or animation of monetary values. The storyboard is documentation instead of a code comment to follow the user's no-comment constraint.

`rail-shape.tsx` owns the bounded SVG curve and matching clip driven by a shared spring value. Path painting is the deliberate exception to transform-only motion: it creates the requested concave shoulders without resizing the layout. Content uses transform/opacity. `room-sidebar.tsx` owns disclosure and focus behavior; `roster.tsx` reads real base-derived membership and balances. An empty slot opens existing entry controls and cannot reserve an indexed seat or sign a transaction.

The state reducer distinguishes closed, hover and explicit opening. Focus inside promotes an opening to explicit; leaving focus, outside pointer-down, Escape or close dismisses it. Collapsed content is inert. Fine mouse pointers support hover only above 600px; compact layouts use an explicit 48px touch trigger and a viewport-bounded panel. Crossing that breakpoint dismisses the rail. The closed hit area stays 80px wide, so the shrinking shape cannot intercept the main canvas or reopen during dismissal. The chart and action layout retain fixed bounds during expansion.

The pinned Framer Motion 13.2.0 hook snapshots reduced motion at mount despite its descriptive documentation. A scoped Zustand preference subscribes directly to `matchMedia` changes instead, with reduced motion as the safe server default. Both initial and changed preferences therefore govern the curve, clip, content and trigger fade.

The brand-design skill guided token mapping and backups; frontend-design-guidelines guided contrast and accessible disclosure; page-load-animations guided spring physics, interruption and motion testing. No new global skills or fonts were installed. Current evidence and remaining limits are in [TESTING.md](TESTING.md).

Motion sources checked: [React animation](https://motion.dev/docs/react-animation), [transitions](https://motion.dev/docs/react-transitions), installed Framer Motion 13.2.0 reduced-motion implementation and registry React 18/19 peer metadata. The single new direct dependency was installed with lifecycle scripts disabled.

## Historical Collect UI-inspired workspace, 2026-09-06

The user rejected the earlier card composition and explicitly requested a heavy revamp based on [Collect UI's Mac App gallery](https://collectui.com/designs/mac-app-ui-design-inspiration). The live gallery was visually inspected, including the enlarged Bakers Studio Branch workspace and surrounding sidebar/application examples. Collect UI is an inspiration gallery, not a licensed component package. No third-party component code, icons, desktop artwork or app assets were copied.

The useful structure was a single application window with a receding sidebar, one content canvas, compact toolbars and shared dividers. FLINCH translates that into real room information, not fake navigation or decorative Mac window buttons. The [Bakers Studio source linked by the gallery](https://x.com/studiobakers/status/2063210245267030117) is attribution for that reference; its X page was not independently inspected.

Direction: native-style two-pane game workspace. Comfortable content density, compact controls. Graphite surfaces and blue actions, with sharp system typography and restrained micro-interactions. No ornamental status dots, gradients, floating metric cards, invented counters or nonfunctional window chrome.

| Previous composition | Implemented composition |
| --- | --- |
| Independent chart, entry and seat sections | One window with a room sidebar and continuous main canvas |
| Four players below the chart | Persistent desktop player list; compact mobile grid |
| Olive/apricot surfaces | Neutral graphite, blue primary actions, light-blue focus and selection |
| Tall chart header, separate toolbar and disclosure rows | Unified chart toolbar, one compact source/status footer |
| Active actions below market context | Active-room controls before the reference chart, in DOM and visual order |
| Repeated zero balances and irrelevant withdrawal controls | Only held/claimable assets in seat rows; withdrawals when applicable; completed state after claims |
| Prominent advanced controls | Expandable session controls and in-room rules |

The lobby retains create/join controls attached below its chart. A room puts funding or SELL/claim controls immediately under round status. Financial logic, stores, consent, session lifecycle and exact-integer quote calculation are preserved. Base-confirmed exits get their own presentation; queued intents never say sold. A source-observed zero holding after a completed sale removes the stale SELL form. Recovery remains visible without a claimable balance, including for spectators.

The SF/system stack remains platform-native; no font files are downloaded. Tokens define the page, canvas, sidebar, control, focus, text and semantic roles. Sixteen representative contrast cases are checked, not a full accessibility certification. Components stay modular and below the 300-line handwritten TypeScript limit. New composition lives in `components/shell/room-sidebar.tsx`; no network logic moved into the shell.

The design-taste skill guided containment and hierarchy; frontend-design-guidelines guided controls, focus, responsive layout and truthful state presentation. Browser review covers real loaded market data and actual local funding, active, queued, claimable and completed states, not fabricated preview players. See [TESTING.md](TESTING.md) for retained run evidence and remaining gates.

## Historical rejected olive/apricot implementation

The [earlier reference review](UI_REFERENCE_REVIEW.md) and `artifacts/design-study/index.html` compare three alternatives. That standalone HTML study was blocked at its file URL and was never visually verified or used to bypass the restriction. It is superseded by the actual application implementation above. The following text records earlier work, not the current direction.

The user rejected the first Rugs-inspired implementation: bubbly type, saturated yellow, decorative live dots, colored avatars, repeated labels and oversized empty panels. The latest request explicitly replaces that direction with SF Pro/system typography, a more independent identity, better alignment and a restrained palette. The separate brand-picker remains deferred; `brand.md` records a provisional implementation pending visual feedback.

Direction: quiet, precise standoff interface. Compact desktop density, readable mobile controls, a dominant reference chart and one bounded action panel. Warm graphite surfaces, off-white text and muted apricot actions. System typography is deliberate, not an unstyled fallback. Motion is limited to control feedback and dialogs.

| Earlier implementation | Current implementation |
| --- | --- |
| DynaPuff display lettering and DM Sans | Native system sans, including San Francisco on Apple devices; both Fontsource packages removed |
| Cool charcoal, yellow actions and decorative colored markers | Warm graphite, apricot actions and sage/brick only for meaningful states or chart movement |
| Tall player sidebar and multiple oversized panels | Four-position row beneath the chart; create/join grouped in one panel on the right |
| Repeated slogans, labels and always-visible empty activity | One rule summary; transaction details appear only after activity; settlement history only when relevant |
| Rounded decorative badges and live dots | Plain network/status text, stronger type hierarchy and consistent panel/control radii |

On mobile, the chart, two-column player row and room controls stack without horizontal overflow. The help trigger becomes a compact question mark with its accessible label intact. Network and wallet controls remain visible. Room address and Open action share a row. Exact token amounts remain separate from reference market numbers.

### Research applied

Read the published Anthropic frontend-design skill and Vercel web-design-guidelines, plus WebKit's native-system-font guidance, Radix's color-scale role definitions and Nielsen Norman Group's visual-hierarchy article. The skill-directory install counts were discovery signals, not evidence that a design is good. No additional skill was installed globally.

The useful principles were a single deliberate identity, typography chosen for actual product use, distinct surface/control/text roles, hierarchy through grouping rather than more borders, semantic controls, visible focus and honest states. These informed this implementation alongside the local frontend-design and design-taste checklists. No copied Rugs assets, manufactured market data or decorative artwork was added.

Native San Francisco is selected through `-apple-system` on Apple platforms. The app does not download or redistribute Apple's font files; other operating systems use system fallbacks. Palette values live in `styles/tokens.css`, not inline in components. Twelve token-contrast tests cover representative text, input/focus, error and chart pairs; they are not a complete rendered-page accessibility audit.

## Historical Rugs reference study

Inspected Rugs.fun at desktop and 390px mobile widths, including its chart, amount shortcuts, trade controls, header, sidebar, history rail and leaderboard. The useful hierarchy is a persistent compact header, secondary left rail, dominant chart, then immediate actions. Cool charcoal surfaces, restrained borders, rounded controls and chunky display type create the arcade feel. Numeric text needs a more legible, tabular face than the display lettering.

The first implementation kept that spatial hierarchy, dense control grouping, dark surfaces and tactile buttons. Its sidebar was the four-seat roster, not chat. There was no leverage, partial selling, auto-betting, fabricated history, arbitrary token selection or copied Rugs branding/assets. Read-only entry remains a designed state, not a simulated game.

That earlier request governed the first charcoal/yellow arcade iteration. It is now superseded by the current direction above; do not restore its typography or palette from this historical study.

On mobile the chart precedes the four-seat roster and game controls. The header retains the network label, rules button and wallet control. The redundant wallet icon is omitted at narrow widths to preserve all three controls without overflow. No percentage similarity or pixel-identical reproduction is claimed.

## State and rendering

Zustand vanilla factories are instantiated per provider, never as shared server user-state singletons. UI preferences and room navigation are separate from market observations and transaction state. Room identity stays in the URL. Wallet secrets stay in memory and out of persistence. Financial truth remains the validated base Ledger and existing transaction journal.

Use narrow selectors; chart updates must not rerender wallet, lobby or transaction components. React effects still own browser lifecycles and cleanup. Zustand does not replace React's lifecycle or the shared client's replay guards.

## Reference chart

Use TradingView Lightweight Charts 5.2.1, with attribution, responsive canvas sizing and explicit line/candle controls. Bootstrap one-minute history from Coinbase Exchange's fixed SOL-USD candles endpoint, then subscribe to its public ticker WebSocket. The public server history adapter coalesces concurrent requests and briefly caches successful results. Validate shape, product, timestamp, positive prices, OHLC bounds and ordering. Bound retained history. Reconnect with bounded backoff, recover history after a gap and mark stale data visibly. No invented candles across missing intervals.

This is offchain Coinbase SOL/USD market context, not a MagicBlock oracle verification or a Raydium devnet quote. It has no authority over SELL, penalties or claims. Historical candles are source candles; the current live candle is formed from received ticker observations and may be incomplete. The existing exact-integer Raydium quote remains the only displayed executable estimate. Number conversion is limited to reference-chart rendering, never balances or penalties.

## Feedback and validation

Sonner supplies dismissible notification feedback; critical signing, expiry and failure details remain inline. An accepted ER instruction never gets a sold toast. Buttons preserve wallet consent and transaction reconciliation. Respect reduced motion, focus visibility, keyboard dialogs, 44px mobile controls and network labeling.

Validate stores, malformed and stale market messages, history aggregation and bounded retention. Verify frontend types, unit tests, production build, responsive browser interactions and existing local wallet/keeper integration. Public deployment and funding remain unauthorized; no mainnet wagering.

Historical olive-theme evidence: 41 web tests and runs `ui-smoke-1788641162057` and `mb-stack-jhwxBo`. These do not validate the latest visuals. Current evidence is recorded in [TESTING.md](TESTING.md).

## Sources

- https://collectui.com/designs/mac-app-ui-design-inspiration
- https://x.com/studiobakers/status/2063210245267030117
- https://skills.sh/anthropics/skills/frontend-design
- https://raw.githubusercontent.com/anthropics/skills/main/skills/frontend-design/SKILL.md
- https://skills.sh/vercel-labs/agent-skills/web-design-guidelines
- https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md
- https://webkit.org/blog/3709/using-the-system-font-in-web-content/
- https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale
- https://www.nngroup.com/articles/visual-hierarchy-ux-definition/
- https://rugs.fun/ and https://rugs.fun/faq
- https://zustand.docs.pmnd.rs/learn/guides/nextjs
- https://sonner.emilkowal.ski/getting-started
- https://tradingview.github.io/lightweight-charts/
- https://docs.cdp.coinbase.com/exchange/websocket-feed/overview
- https://docs.cdp.coinbase.com/exchange/websocket-feed/channels
- https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-candles

Package versions were checked against registry metadata before the install that removed the two font packages. At 2026-09-05T20:43:52Z, MagicBlock's service API reported public-devnet Asia/Europe/USA ER/router/pricing-oracle services operational and the TEE Asia router down. This read-only snapshot is not a FLINCH devnet integration test or an availability guarantee.
