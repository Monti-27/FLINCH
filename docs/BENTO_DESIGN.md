# Landing bento

## Current direction, 2026-09-11

Keep one five-card band. The latest reference-led pass replaces only the first two miniatures and fixes second-tile edge fading. All five illustrations loop. Replay buttons, bottom disclaimer and separate bento pause button remain removed. FAQ, rules and test-build disclosures remain.

Direction: pale, tactile product miniatures with one focal object per tile. Comfortable density and fixed outer surfaces. Typography: existing Manrope and Space Grotesk, quiet and tightly aligned. Motion: crisp damped springs with brief reading holds, rather than the rejected slow pacing.

Do: keep the WSOL heading stationary, use four equally sized stake chips, separate moving Control from token custody, preserve the approved other three designs, reserve clearance for the entire return/reset transition.

Do not: deal tickets from the centre, rotate stake labels, add fake activity or monetary values, add status dots or more controls.

The first is a recessed vault tray with four identical chips using official Solana artwork. Chips settle vertically in pairs without dealing outward from the center. Their horizontal positions, sizes, WSOL heading and outer sheet stay fixed. The second uses a layered Control panel with three intent records, a Queue/Batch/Return progression and short rails to stationary Solana custody. The complete Control panel returns 16px; it never overlaps custody. Neither tile has a bottom fade over its meaningful content. Separate custody and rollup styles prevent changes leaking into the other three scenes.

The decision, holder-share and withdrawal scene components retain their source and design. They inherit the quicker shared spring and dwell. This task does not edit footer markup, artwork, typography or CSS. A concurrent task removed the footer motion button and its browser expectation; preserve that change. The ambient pause binding remains available in state, but this pass does not claim a visible manual pause control.

## Reference

Three newly supplied images govern this pass: the automotive bento contributes large focal objects and layered depth; the Code/Design/Writing/Building grid contributes deliberate miniature interfaces; the pale crypto grid contributes clean surfaces and readable asset hierarchy. No new video was attached with these images. The older video below remains useful but was not represented as a new recording.

Public references inspected on 2026-09-11: [BentoGrids](https://www.bentogrids.com) and [Magic UI Bento Grid](https://magicui.design/docs/components/bento-grid). The loaded gallery and component preview are retained in `artifacts/runs/bento-study-jYagY2`. Chroma's layered plates and the gallery's restrained miniature interfaces informed depth and containment. Magic UI demonstrates separating motion from stationary copy. No third-party code, screenshot pixels, generic icons or new dependency was copied into the product. CUA was unavailable; inspection used a fresh unauthenticated browser.

The user's `0dBZFHNDQQxaXYQ9-optimized.mp4` is a 9.984-second product-interface study. Sixteen frames and a contact sheet remain at `artifacts/runs/bento-reference-20260911`. Three compact top tiles and two wide lower tiles, white miniature interfaces, pale grey surfaces and restrained blue depth inform the implementation. No source-video pixels, avatars, balances or hiring text ship with the bento.

The earlier four-rule grid remains removed. Navigation targets `#onchain`; `#how-it-works` remains a zero-size positional alias. Preserve hero, FAQ, arena, palette primitives and fonts.

## Motion storyboard

```text
Initial HTML    Complete copy and meaningful static diagrams
Phase 0         Four chips above sockets / empty intent records / hold / initial shares / ledger
Phase 1         First two chips settle / records gather / sell / seller share leaves / ledger
Phase 2         All chips settle / batch reading hold / sell holds / holder shares / claim sheet
Phase 3         Equal-entry hold / Control approaches base / hold / shares hold / claim holds
Next cycle      Soft return to phase 0 without remounting or replaying the outer cards
Offscreen       Only the affected card stops advancing
Hidden tab      All card timers stop
Ambient pause   Existing state binding stops progression; no new control is added
Reduced motion  Static diagrams and no stage changes; preference updates live
No JavaScript   Static diagrams, copy, links and native FAQ stay available
```

Stage dwell is 850/950/1150/1100ms: a 4.05-second loop, down from 6.2 seconds. One-time per-card offset is 100ms; detail stagger is 60ms. Spring stiffness 300, damping 30 and mass 1 make the response quicker with negligible overshoot. The static asset labels, product descriptions and card dimensions never animate. A spring already in progress can finish its short transition when progression pauses.

`bento-state.ts` owns provider-scoped phases and bounded cycle counters. `bento-motion.tsx` owns visibility and timer cleanup; Framer Motion interpolates without per-frame React state. Manual preference belongs to `ambientMotionPaused` in the existing UI store, renamed from its footer-specific predecessor. System reduced motion remains independent. This does not change market data, financial number motion, wallet state or game timing.

The storyboard lives here rather than in code comments. Miniature labels are intentionally small like the reference; actual product copy is separate at 12–13px. Decorative art is hidden from assistive technology.

## Truth boundaries

Only Control enters the ER. Token custody remains on Solana. Intent acceptance does not complete a sale. Raydium executes the actual swap; a confirmed base transfer completes withdrawal. The penalty plot remains marked schematic and not to scale. No price, balance, signature, live player or transaction outcome is fabricated. The removed redundant caption is not a removal of the FAQ/rules disclosures.

## Validation

Latest development evidence: `artifacts/runs/bento-1789075537702/result.json`. `bento-containment-browser.ts` samples every browser animation frame across two complete cycles at 320, 375, 621, 768, 901, 1280 and 1920px. It checks first-two labels, icons and moving surfaces against art/ancestor clipping, plus Control-to-custody clearance and both reset transitions. All widths pass with approximately 14px Control clearance and at least 20px edge clearance. Existing five-scene loops, offscreen/hidden stops, live reduced motion and no-JavaScript checks also pass. No wallet or chain action is involved.

The browser reproduction found the old custody rail intruding into the bottom 24px fade; the old phase-three batch also consumed almost all its workspace height. The fix reserves vertical travel space and removes only the first-two fade overlays rather than allowing uncontrolled overflow. The approved remaining scenes and their stylesheet match the pre-change archive.

Latest scoped backup: `artifacts/runs/bento-depth-before-wUletG/source.tar`. Production verification is recorded in TESTING. Earlier runs below are historical and do not validate the current compositions.

Final production evidence: `artifacts/runs/bento-1789075905574/result.json`, including the multiline stake label, every loop phase/reset, 13.97px minimum Control clearance, 20px minimum art inset, no runtime errors and no external requests. Production landing-only regression `landing-1789075709353` passes. Both type checks, 403 web tests, isolated build, source/selected-artifact scans and brand parity pass. These are UI checks, not live protocol or devnet validation.

Current development evidence: `artifacts/runs/bento-1789073594918/result.json`. Five widths (320/375/768/1280/1920), two repeated cycles in every card, shared keyboard pause/resume, hidden/offscreen stops, live reduced motion, no-JavaScript, official assets and no external requests pass. WSOL identity, Control's base custody rail and outer card geometry all shift zero pixels. The local 4x-CPU probe observes 172 distinct Control positions and 54 seat-fill scales; it is not a physical-device performance guarantee.

Production evidence: `bento-1789074047321`, with two repeated cycles per scene and zero card/base/WSOL drift. The matching frozen landing/404 suite passes in `landing-1789074138127`. Final workspace snapshot: 386 tests and both type checks pass; isolated production build passes. See TESTING for exact scope and concurrent-hero snapshot differences.

The earlier one-shot run `bento-1789073000533` and preceding replay/pause run `bento-1789071869102` remain historical evidence only.

Backup before this refinement: `artifacts/runs/bento-refine-before-JHNcCt/complete-source.tar`. Never restore it over concurrent work. No wallet action, funding, chain mutation, sandbox reset, dependency install or deployment is included. Cross-browser/physical-device and user visual acceptance remain open; protocol/devnet release gates are unchanged.
