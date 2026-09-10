# Navigation and rules

## Room utility bar, 2026-09-11

The screenshot's Lobby / Invite players / Check transaction row stays below the header, with Lobby left and the two room utilities grouped right. It now has 44px native buttons, eight pixels of vertical focus clearance, explicit neutral button surfaces and a pale invite action. Its gutters align with the arena. Mobile keeps visible Lobby / Invite / Check labels, rather than an unexplained transaction icon. The navbar dropdowns and compact footer are unchanged.

`components/shell/room-navigation.tsx` and its CSS module own the utility bar. A local in-flight guard prevents duplicate status checks and reserves the label width while checking; the existing reconciliation handler and notification outcomes are unchanged. Disconnected wallets and active wallet operations still disable Check transaction. The toolbar is keyed separately from Match so connecting a wallet cannot retain a duplicate toolbar.

`room-invite.tsx` preserves canonical same-origin links, clipboard success, bounded failure/manual copy, selected input, Escape and focus return. The mobile manual panel is anchored to the toolbar instead of an offset tied to the old icon-only button width. The frontend design guidelines informed contrast, fixed hit targets, source order and reduced-motion checks. No financial instruction, wallet authorization or protocol behavior changes.

## Rules dropdown follow-up, 2026-09-11

The user rejected the large arena rules modal. How to Play is now a third section of the same connected navigation surface as The game and Protocol. It shares the 408px desktop width, selected-button spring, measured height transition, inset numbering and text alignment. Three short rows replace the facts strip, two-column cards, detail disclosure and confirmation action. The visible note preserves queued-versus-sold and failed/expired-swap semantics.

`NavigationPanel` and `openNavigationRules` extend the existing scoped UI store. The arena no longer mounts `HelpDialog`. Its player and footer rules shortcuts open/focus the same navigation section and scroll the header into view when needed. The landing footer's existing full guide remains unchanged because that page has no arena navbar. The duplicate mobile question-mark shortcut is removed; four readable menu items remain in one row, with Game/Rules labels on compact screens and full accessible names. Escape returns to the navbar trigger or compact menu toggle. Tab may leave the disclosure; there is no modal focus trap, backdrop or body scroll lock.

The existing motion storyboard applies unchanged to the new section. Trigger identity is established synchronously before the deferred external-shortcut focus, so immediate Escape cannot return to an older section. The native short-viewport surface scroll keeps the final caveat reachable. No financial or network behavior changed.

Production rules proof: `artifacts/runs/navigation-1789078444337/result.json`. Current local-game proof before the focus-order refinement: `navigation-1789078220790`. Seven widths from 320–1920px, compact/short screens, actual touch input, all three sections, interruptible transitions, outside/click/Escape dismissal, external rules shortcuts, keyboard focus, live reduced motion, no arena movement and zero submitted transactions pass. Total menu height is about 451px desktop and 481px at 320/375px. Both type checks, 452 web tests, isolated production build and 348-module/697-file selected scans pass. The existing optional bigint-binding warning remains.

Broader production UI regression also passes: `artifacts/runs/ui-smoke-1789078574296/result.json`. Its earlier failures retained the immediate-Escape issue and an old test trying to use the removed mobile question-mark shortcut; the test now opens the mobile menu through the actual interface.

Compiled preview: `http://127.0.0.1:3417/play`, snapshot `/tmp/flinch-rules-build.Mx9ALx`. All touched application files match that snapshot. The actual game remains at port 3400 on its original process/genesis. No funding, wallet transaction, deployment, Git operation or publication. Protocol/devnet/ten-round gates and physical-device/cross-browser acceptance were not rerun. Earlier card documentation below is superseded only for the arena.

## Direction, 2026-09-11

The user requested removal of the repeated test-token/ecosystem strip below the arena header, smoother Framer Motion navigation inspired by the supplied video, and a more deliberate How to Play card. This is a presentation-only change. Footer disclosures, network identity, financial handlers and protocol rules remain intact.

The reference is `/Users/montisaini/Downloads/NXkWTNL5B0ozGGoE-optimized.mp4`, 25.52 seconds at 60 fps. Frames from 3.2–5.0 seconds show a compact dark dropdown extending directly from the navigation, consistent row alignment and a quiet entrance. The connected surface and compact reading order inform FLINCH; no reference implementation or third-party assets were copied. The supplied screenshots document the detached two-column menu, duplicate strip and oversized paragraph-list dialog being replaced.

## Ownership

- `navigation.tsx`: native navigation buttons, shared selected-item spring, outside interaction, Escape and focus departure.
- `navigation-motion.tsx`: measured content height, interruptible expansion, content cross-fade and ResizeObserver cleanup.
- `navigation-content.tsx`: game summary and actual protocol documentation links.
- `help-dialog.tsx`: native top-layer dialog, Framer entrance/exit, keyboard containment, scroll lock and dismissal.
- `help-content.tsx`: four short rules, round facts, visible settlement caveat and native finer-details disclosure.
- `help-dialog.module.css`: scoped rules hierarchy, two-column desktop reading and one-column mobile flow.

The existing provider-scoped live reduced-motion preference remains authoritative. No mount-only preference snapshot or new dependency was introduced. The frontend-design and page-load-animation skills guided hierarchy, focus targets, measurement and motion lifecycle. Storyboards stay here rather than adding source comments.

## Motion storyboard

| Event | Sequence |
| --- | --- |
| Open menu section | Immediately select the button; spring measured content height from its current value; fade/translate content by 6px over 150ms |
| Switch section | Move the selection between buttons; retarget the same height spring; cross-fade the two retained panels |
| Close | Make hidden content inert immediately; spring the surface closed without moving the arena |
| Compact menu | Short 8px entrance and opacity spring; cap the surface to the viewport and permit internal scrolling |
| Open rules | Native modal and focus capture immediately; 250ms fade, 12px entrance and 0.98-to-1 scale |
| Close rules | 150ms fade/8px exit; close the native dialog after completion and restore trigger focus |
| Reduced motion | Instant target values, including preference changes during motion |

The height spring is stiffness 420, damping 38. Measurement is independent of the animated wrapper, preventing feedback loops and text scaling. Both menu sections retain stable IDs and inert inactive content. The panel is a disclosure, not an ARIA application menu. Layout projection is confined to the selected-button background.

## Content boundaries

The rules retain equal 0.001–0.01 test SOL stakes, four players, 90 seconds, up to 0.25% from current WSOL, same-cohort exceptions, natural final holder and multiple timeout holders. Successful sales yield actual USDC. The visible caveat states that a queued intent is not a confirmed sale and failed/expired swaps charge no game penalty. The disclosure retains two-second cohorts, all-holder zero penalty, base recovery after 30 seconds and separate reference-price/fee/rent limitations. No displayed number represents a new quote or transaction.

## Evidence

- Production navigation/rules: `artifacts/runs/navigation-1789077705330/result.json`.
- Broader production UI regression: `artifacts/runs/ui-smoke-1789077706512/result.json`.
- Current local game: `artifacts/runs/navigation-1789077648014/result.json`.
- Seven widths, 320–1920px; short compact viewport; real intermediate expansion frames; no arena shift; rapid switching; mouse/keyboard dismissal; focus trapping/return; finer-details keyboard interaction; live reduced motion; landing rules; no horizontal overflow; zero page errors and zero submitted wallet transactions.
- Both TypeScript checks and 450 web tests pass. Production build passes with all type checking enabled. The optional bigint native-binding warning remains; the library uses its existing JavaScript implementation.
- Source scan: 346 handwritten TypeScript modules. Selected secret/generated-artifact scan: 694 project files. These are bounded pattern scans, not a security audit.
- One local 4x-CPU menu probe measured p95 frame interval 17.3ms and maximum 36.4ms. This is not a universal frame-rate guarantee.

The isolated compiled workspace is `/tmp/flinch-navigation-build.fVHlhU`; its read-only preview is `http://127.0.0.1:3416/play`. The existing funded game on port 3400 was never restarted. Reference study and before-source archive are `/tmp/flinch-nav-study.BuNHbV`. Do not restore that archive over concurrent work.

Earlier checks caught a navigation Motion prop typing mistake, an insufficient browser-startup timeout, missing test/type dependencies in the isolated copy, and a concurrent landing-test type error. The current passing runs follow those corrections; no unrelated implementation was edited to obtain a pass.

This task did not rerun protocol authorization/conservation, the local onchain cycle, public devnet routing/session/oracle/swap/recovery/withdrawal or ten-round gates. No deployment, funding, pool creation, Git operation or publication occurred. Safari/Firefox, physical devices and user visual acceptance remain unverified.
