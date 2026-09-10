# Reference accordion

The 2026-09-11 accordion reference is the user-supplied `R7-MiatOvSvoJfoH-optimized.mp4`: 21.6 seconds, 1296 frames at 60 fps. All frames were decoded to contact sheets in `artifacts/runs/accordion-reference-QHAbys`; the opening, closing and colored states were visually inspected. No third-party code, copy or assets are imported.

The user's latest screenshot feedback removes the nested rounded panels and excess spacing while preserving the white theme, geometric page rails and heading. The FAQ now sits directly in the section: a centered 640px reading-width list, fine horizontal separators, 64px question targets and answers aligned with question text. There is no dotted stage, fixed-height wrapper, row surface, rounded group or separation margin. The section has 56–80px vertical padding and the introduction has a 28–32px gap before the list.

The rotating plus, sharpening answer and traveling blue-to-amber wash remain. The wash follows the reference's downward sweep and fade, not a permanent colored background. It is a layered CSS effect animated by Framer Motion, not a WebGL shader. Its pastel colors are scoped to this reference treatment; copy, landing palette, financial controls and completed hands footer are unchanged. The frontend-design and design-taste skills guided the flat-list structure, reading width and shared text alignment.

## Motion storyboard

```text
Activate summary                 0 ms
  row height opens               0–400 ms
  answer sharpens                0–400 ms
  plus turns into close          0–400 ms
  colors sweep down and fade     0–1100 ms
Read answer, all motion stopped   settled
Activate another summary         reverse old / open new together
```

Framer Motion springs follow measured content heights, with ResizeObserver handling wrapping and font changes. Repeated activation reverses from the current position. The actual rendered height is explicitly locked before changing native `open`; the earlier version incorrectly relied on an unchanged MotionValue emitting an update, allowing an immediate expansion before animation. A per-frame browser regression catches that snap. Native details and complete answer text render before JavaScript; keyboard interaction and browser text search remain native. Reduced motion settles immediately, including when the preference changes during a transition. There is no idle animation or application animation timer. The decorative color sweep outlasts the height change per the user's request, without delaying reading or interaction.

The page-load-animations skill guided measured, interruptible springs. Frontend-design-guidelines guided focus, touch targets, contrast and reduced motion. The storyboard lives here because project instructions prohibit code comments.

## Verified result

Current flat-layout production evidence is `artifacts/runs/faq-1789073529337/result.json`, with landing checks in `artifacts/runs/landing-1789073405339/result.json`. The browser checks retain frame heights, repeated flow transforms/opacities, zero answer-alignment drift and container geometry. The desktop closed list is 321px tall, replacing the previous 600px panel. See TESTING for the full scope and remaining device/release limits. The isolated preview runs at `http://127.0.0.1:3112/#questions`; its source and the pre-change FAQ files are retained in `artifacts/runs/faq-layout-EuSKVz`.
