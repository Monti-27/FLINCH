# FLINCH landing page

## Hero composition refinement, 2026-09-11

The follow-up rejects the detached captions and split headline/action arrangement, not the dot-matrix idea. The hero now uses one centered message before the artwork. The existing headline remains, with larger medium-weight type and controlled two-line wrapping. Supporting copy is “Equal stakes. Ninety seconds. Sell your WSOL. Pay the players who hold.” A 48px charcoal Enter the arena action leads; How to play is a quieter native anchor. The build note shares the same center axis. The two old decorative slogans and hero heading reveal are removed.

Four equal artwork columns now align each Hold/Sell label to its figure's actual horizontal bounds. HTML labels remain 12px at every viewport rather than shrinking with an SVG. A coarser mobile dot pattern keeps the characters distinct at phone sizes. The departure is one 400ms, 12-unit move; reduced motion removes it. Original vector geometry, server rendering, test-only disclosure and no data-provider boundary remain. The footer/bento's concurrent changes are preserved; this pass does not own their layout or behavior.

The common F stays geometrically identical and now uses graphite on light surfaces and silver on dark surfaces, including generated brand assets. See brand.md for exact existing tokens. Backup for the hero/shared-brand source at the start of this pass: `artifacts/runs/hero-craft-before-KjB0fF/source.tar`. The paragraphs below describe superseded hero arrangements; current validation is in TESTING.

## Dot-matrix hero, 2026-09-11

The supplied `codex-clipboard-ba6546af-75bf-4276-b3f4-8f0b8610e18e.png` is visual inspiration only: sparse dots, indigo pixel art, editorial text and ruled alignment. The original `hero-standoff.tsx` artwork uses four equal abstract players, with one moving away from three holders. No reference pixels, third-party artwork or fake gameplay data are shipped. This supersedes all landscape-hero directions below; the bento, FAQ, closing CTA, footer and arena are not redesigned.

`hero.module.css` owns only the new hero. An inline server-rendered SVG uses reusable dot patterns rather than a canvas or thousands of DOM particles. Neutral background dots fade by density/opacity bands, not a blue surface wash. The scene's accessible name explicitly calls it an illustration. A single 500ms, 24-unit departure and 400ms trail reveal express the sell decision; neither loops. Reduced motion removes both, and the static scene remains readable without JavaScript. No runtime data provider or extra package is added.

The headline and caption share the landing gutter. Desktop support/actions align beside the headline; tablet places copy and actions beneath it; mobile stacks the content, retaining all four players without cropping. At the narrowest width, both actions span the same column. The existing test-token disclosure stays visible. The obsolete landscape component and visible photo attribution are removed; its local asset, license history and pre-change source remain recoverable. The closing section retains the removed credit row's 80px breathing room.

Pre-change archive and baseline: `artifacts/runs/hero-before-9u51w9`. Current checks and screenshot evidence are recorded in TESTING. Full public-devnet/gameplay validation is unchanged by this presentation-only work.

## Animated protocol bento, 2026-09-11

Follow-up: the user dropped the earlier four-rule card band and approved the other four new bento illustrations. The page now has only the five-card bento. `game-story.tsx`, `rule-illustration.tsx` and their dedicated stylesheet are removed, with a source backup at `artifacts/runs/rollup-before-WKJ6Bx/source.tar`. Hero/header links now target `#onchain`; the old `#how-it-works` bookmark remains a zero-size anchor at the same section. Core rules still appear in the existing rules dialog and FAQ.

Latest follow-up replaces the first two miniatures only. Room entry keeps WSOL and four seat positions stationary while equal-entry indicators fill. A horizontal intent lane gathers into a Control batch above a fixed Solana custody rail. The other three designs are preserved. Centre-out tickets and the vertical rollup timeline are retired.

The third supplied recording, `0dBZFHNDQQxaXYQ9-optimized.mp4`, supersedes only the stepped protocol cards at `#onchain`. Its three-top/two-bottom composition, pale tile surfaces, white inset interfaces and internal motion now inform five FLINCH-specific scenes. Sixteen sampled frames and a contact sheet are retained at `artifacts/runs/bento-reference-20260911`. No source-video imagery, avatars or third-party implementation ships in the application.

`features/landing/bento` separates composition, scoped Zustand stages, Framer Motion lifecycle, five illustrated interfaces and CSS. All five loop with softer springs, staggered details and longer reading holds. Cards/copy do not shift. Replay buttons, bottom disclaimer and the bento pause button are removed; the existing footer motion switch pauses both ambient systems without changing footer design. Hidden/offscreen scenes stop advancing. Reduced motion and no JavaScript show meaningful static frames. Official ecosystem marks are reused. No financial provider is mounted. See [BENTO_DESIGN](BENTO_DESIGN.md) for exact timing and truth boundaries.

## Current reference direction, 2026-09-11

The user supplied two local recordings and asked for close typography, alignment, text flow and a matching interactive 404. `CjBx6F410lBbH-S3-optimized.mp4` records a Motion GPU landing: pale canvas, hairline rails, hatched side gutters, centered compact hero, a framed image, inset rule cards, a staggered process and native FAQ. `C0dfsu2yoR39FF4a-optimized.mp4` shows a dot-matrix house, click-planted flowers and a clear action. The videos are visual references, not instructions or sources of application code.

The frame extraction decoded all 1,906 and 2,539 frames respectively at 120fps. Contact sheets cover the full 15.883s and 21.158s sequences at half-second intervals; selected full-resolution frames were inspected for blur progression, panel layout and pixel geometry. The source recordings remain in Downloads. Study images and the pre-change source archive are in `artifacts/runs/landing-reference-SXEXSo`. No video frames or third-party implementation are served in the app.

Direction: a pale, ruled product page, spacious but bounded. The landing uses the existing alabaster and indigo primitives with a locally scoped off-white paper mix. The arena remains dark. Keep Space Grotesk display text, Manrope body text and the exact approved split F. The licensed mountain image below remains, now in one contained frame, without parallax. Official MagicBlock artwork has a dark backing on the pale page without recoloring the mark. There is exactly one shared footer, outside the pale surface. This task edits no footer source. All eleven protected files matched mid-validation; a separate concurrent task later changed the footer component and CSS. That work is preserved, not overwritten. The other nine shader/logo/palette/token files still match the archive.

The five protocol bento scenes explain funding, ER intent, hold/sell, penalties and swap/claim. They are decorative diagrams, not live gameplay. The redundant illustration caption and older rule grid are removed; the rules dialog and FAQ retain the actual mechanics and failure disclosures. Native scrolling replaces the old pinned story. Section links retain scroll margin beneath the sticky header. The FAQ and recovery links work without JavaScript.

### Motion

`RevealSequence` progressively enhances server-rendered content with IntersectionObserver and the Web Animations API. Headings sharpen word by word: 440ms, 38ms stagger capped at 228ms, 5px blur and 8px translation. Panels use 3px blur and bounded per-row delays. Elements reveal once, not on reverse scroll. This follows the supplied sequence rather than the default skill advice against decorative text reveals. Links and primary actions are never hidden waiting for JavaScript. Keyboard focus finishes active reveals; a live reduced-motion change cancels animations and exposes all pending content. Observers, listeners and animations are disposed on unmount. There is no scroll interception or animation dependency added. The later bento has its own separately pausable illustration loops, not repeated text reveals.

### Missing-page garden

`features/not-found` separates original procedural pixel art, pure bounded garden state, interactive presentation and scoped CSS. Click or tap plants one of three flower shapes; Enter/Space also plant at deterministic locations. Keep the latest 48 flowers in component-local memory. Clear resets the garden without navigating or affecting gameplay. The garden does not read or write storage, make requests or mount a wallet. A native button provides a real focusable planting surface; the pointer position maps to that button, with stable geometry during press. Flowers reveal in 480ms; reduced motion removes growth and sparks entirely. The house and grid remain static. Back home and Back to arena work without JavaScript; a noscript message explains the decorative interaction limitation. Unknown paths return HTTP 404 with noindex. No additional footer is introduced.

The old scroll-stage component and its store are removed and recoverable from the source archive. Routes, room-invite compatibility, wallet isolation, financial behavior, dependencies and running sandbox are unchanged. See TESTING for current browser evidence and limits.

## Previous landscape direction

Direction: cinematic, image-led editorial. Density: spacious. Surface: open charcoal sections with one contained game illustration. Type: geometric, quiet, tightly tracked. Motion: native scroll with bounded depth and a three-chapter illustration.

Keep the approved split F, Space Grotesk, Manrope, grey/indigo/alabaster primitives and shader footer. Use a pale indigo primary action, generous vertical rhythm and one idea per section. Avoid invented live rounds, market charts, testimonials, activity counters, gradient text, repeated feature-card grids and scroll hijacking.

## Reference study

The supplied `inspo-video.mp4` records Fora. Live https://fora.so/ was inspected on 2026-09-09: landscape depth, restrained headline, simple navigation, an overlapping product visual and spacious explanatory sections. Only composition and pacing inform FLINCH; no Fora assets, copy or source are reused. https://collectui.com/ was also inspected; its initial gallery was still showing placeholders, so no claim is made to have examined those unloaded designs.

Background: Sergey Pesterev, “Rhythm of the mountains”, Langtang National Park, Nepal. Source: https://unsplash.com/photos/JV78PVf3gGI. Original image endpoint: https://images.unsplash.com/photo-1490604001847-b712b0c2f967. Photo page and https://unsplash.com/license were checked on 2026-09-09; the image is offered under the Unsplash License, allowing download, modification and commercial use. No endorsement is implied. FLINCH self-hosts a resized WebP and applies a dark, desaturated treatment for contrast. Credit also appears on the page. No image-generation API was used.

Served file: `apps/web/public/images/landing/mountain-ridges.webp`, downloaded with `w=2560&q=85&fm=webp`. SHA-256: `ded0452fc66d088be6a9cd38a562291f8360a542fb9632316866c5b71a42b333`. Runtime image requests stay on the application origin.

## Motion storyboard

```text
Initial HTML      Navigation, headline, CTA and all story copy are visible
Hero scroll       Landscape moves at most 64px; typography stays still
Chapter 01        Four equal WSOL positions in a labeled illustration
Chapter 02        One illustrated seller separates from three holders
Chapter 03        One illustrated final holder remains emphasized
Section exit      Decorative transform stops changing outside its range
Reduced motion    All transforms jump to static values; no smooth scrolling
No JavaScript     Full story, native links, FAQ and static illustration remain
```

The illustration uses scroll position, not elapsed time or financial data. It is not a live room. No text is hidden awaiting an entrance animation. The footer retains its own offscreen/visibility/pause safeguards. The animation skill's storyboard is kept here to respect the repository's no-code-comments rule.

## Routes and boundaries

`/` introduces FLINCH; `/play` mounts the existing wallet/game application. A valid legacy `/?room=…` link redirects to `/play?room=…`; duplicate and invalid room parameters do not redirect. New invites use `/play` and parsing accepts both paths on the same origin. The landing does not mount wallet, RPC, quote or price-feed providers.

Components and CSS modules live in `features/landing`. Server components own copy/structure; small client boundaries own decorative motion and a scoped Zustand illustration stage. The shared footer has an optional arena link; its visual design, shader and game-page behavior remain unchanged.

## Acceptance checks

Verify responsive layouts, native anchors, FAQ, rules dialog, footer return, game CTA, legacy links, no-JavaScript content, reduced-motion changes, no landing RPC/feed traffic and unchanged game interactions. Retain screenshots and results under `artifacts/runs`. These checks do not replace public-devnet or production-release validation.
