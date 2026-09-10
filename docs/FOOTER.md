# Reference hands footer

## Compact arena footer, 2026-09-11

The arena now uses `data-layout="arena"`, independently of theme. Its scene is 200–280px tall with 16px outer padding and hands capped at 360px wide to stay clear of links. Closed height is 364px at 320/375px, 320px at 768px, 376px at 1280px and 400px at 1720/1920px. Previously it was 614px at 1280px and 500px on mobile. Landing size in both themes, artwork, shader lifecycle, logo, touch targets and rules navigation remain unchanged. The frontend design guidelines informed route-specific sizing, clearance and responsive verification.

Network details show configured Solana Devnet or Localnet. Disabled transactions mean read-only preview, not undeployed program. Token/value/reference-price disclosures remain inside native details. Production evidence: `footer-browser-1789080708076` and `ui-smoke-1789080709323` under `artifacts/runs`. Preview source `/tmp/flinch-footer-build.hZvph8`, loopback port3418. No public deployment or chain transaction occurred in this UI pass.

The user's 2026-09-11 request replaces the earlier Waves footer. The supplied `jhuKQgm0hkWM3rWB-optimized.mp4` is a 1720 × 1080, 60 fps, 915-frame recording of Good Fella's footer. All 915 frames were decoded and reviewed in sixteen sequential contact sheets, with full-resolution frames inspected for the character texture and finger outlines. Reference evidence and the pre-edit source backup are in `artifacts/runs/footer-hands-7Iu1E6`.

## Artwork

The hands are crops of frame 600 from the user's file, not newly drawn hands or generated approximations. `scripts/extract-footer-hands.py` checks the source SHA-256, extracts separate 700 × 400 regions, removes the dark background, and clips unrelated page lettering outside the right fingers. The follow-up strengthens faint character strokes using a revised alpha curve while retaining their positions and the original silhouette. The two self-hosted PNG masks total about 120 KB. Unit tests retain their exact hashes.

The follow-up internet comparison confirmed the source at https://good-fella.com/ and examined https://github.com/lewiscasewell/michelangelo as another Creation of Adam ASCII interpretation. The latter is not the supplied pose and was not copied. The original site renders two separate hand canvases; no higher-resolution source or licensed 3D model was acquired. The supplied recording remains the actual artwork source.

This preserves the recorded hand design at its available resolution, not the original site's 3D assets or per-character animation. It does not reproduce the original site copy, subscription form or Good Fella wordmark. The reference remains user-provided material; no broader asset license or permission for public redistribution was verified. Review that before publication.

## Composition and motion

The landing footer is light and sits outside main but inside the existing inner geometric rails. The redundant rounded closing CTA is removed. The game footer remains full-width charcoal through the default dark variant. Both use the same two hands and persistent Flinch × MagicBlock lockup. A shared responsive clearance keeps the complete hand boxes at least 12px from the identity, including during entrance. Narrow screens crop the wrists and stack the lockup. The approved split F geometry and official toolbar icons are unchanged. The footer slogan and motion button are removed by explicit request; documentation, rules, arena navigation and test-network disclosures remain.

| Time | Behavior |
| --- | --- |
| Before JavaScript | Both hands and the complete wordmark are visible, with a static color treatment |
| First visible intersection | The left hand enters from outside; the right follows after 120 ms |
| Next 1.65 seconds | Framer Motion springs settle without bounce; the text does not enter, exit or dissolve |
| While visible | Two lightweight WebGL surfaces render continuously bending coral, violet and teal bands inward through the character masks, at the display's animation-frame cadence; the center text shifts slowly through readable colors |
| Offscreen or hidden tab | The continuous color animation stops and resumes from the retained time |
| Reduced motion | Entrance transforms are skipped or completed immediately; all color animation is disabled |
| No WebGL or context loss | The same masks remain visible with a static multicolor treatment; restored contexts resume the shader |

The motion skills guided spring timing, explicit named delays, native controls and reduced-motion cleanup. The user's request takes precedence over generic short-duration or no-decorative-gradient guidance. The storyboard stays here because project code must not contain comments.

`components/shell/footer-hands.tsx` owns motion and visibility. `footer.tsx` owns content/actions and its explicit theme; `styles/footer.css` owns positioning, palette and masks. `lib/shader/hand-flow.ts` provides the curved current. The existing shader surface now accepts a renderer, frame interval and resolution override while retaining the previous Waves defaults for other callers. Hands render the low-frequency color field at CSS-pixel resolution; the independent PNG masks retain their full character detail. The shared ambient preference remains supported internally, without a visible footer toggle. No financial behavior, wallet flow, protocol, dependency version or public deployment changed.

## Validation

`apps/web/tests/footer-browser.ts` checks both routes at six widths, inner-rail alignment, light/dark surfaces, no hand/identity overlap, persistent identity, visible entrance travel, framebuffer and masked-image variation, reduced motion, offscreen/hidden behavior, context loss/restoration, keyboard rules and no-JavaScript/no-WebGL artwork. The bento browser expectation now reflects the explicitly removed footer motion switch. See TESTING for final evidence and limitations. The before-state archive is `artifacts/runs/footer-contained-NmQeEE/before.tar.gz`.
