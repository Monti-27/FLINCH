# Landing themes

The landing page supports light and dark appearance without changing the existing stylesheet files, dot geometry, spacing, typography, or illustration timing. New styling uses Tailwind v4 utilities in `features/landing/theme`. Important modifiers are scoped to the new theme because existing unlayered CSS otherwise takes precedence over Tailwind's utility layer. No global palette primitives are overwritten.

The device preference is used until the visitor selects a theme. Only `flinch:landing-theme` is persisted. A small constant bootstrap applies the choice before the landing content is parsed; a layout effect handles client navigation. Blocked or invalid storage falls back safely. Other tabs synchronize changes. The game, recovery page, wallet providers, and transaction state do not inherit the landing preference. The existing rules dialog retains its dark appearance.

The header switch uses the existing Lucide package, a 44px target, switch semantics, visible keyboard focus, and reduced-motion-aware icon changes. No JavaScript leaves the original light page, native disclosures, links, and a disabled switch available.

## Glimm

Sources inspected on 2026-09-11:

- [Official documentation](https://glimm.dev/)
- [Theme-switch demonstration](https://glimm.dev/demos/theme)
- [Published package](https://www.npmjs.com/package/glimm/v/0.3.0), including its README, declarations, and implementation

The website footer lists 0.1.4, while npm's latest tag resolves to 0.3.0. The application pins 0.3.0 and uses its documented framework-independent `createShader` and `playSweep` API. Installation disabled lifecycle scripts. The package is MIT licensed and has no runtime dependencies.

Only deliberate theme changes trigger a prism sweep. No link interception or route animation is installed. The band travels for 650ms and fades for 180ms, reversing direction between themes. The theme commits once at the midpoint. This reference-led timing is deliberately longer than a button micro-interaction and shorter than the package defaults.

The library loads on demand. Each sweep disposes its animation, resize observer, shaders, buffers, and program when done. The canvas stays hidden between changes. Reduced motion and unavailable WebGL switch immediately. A live reduced-motion change, hidden document, context loss, or an 1800ms deadline finishes the requested change and clears the overlay. Unmount cancels without applying stale state. Repeated clicks cannot start overlapping transitions.

## Detail coverage

Dark tokens cover the page rails, hero figures, buttons and hover states, section labels, all five bento scenes, FAQ text and its color flow, official-logo backings, selection, and footer. The footer's real WebGL palette updates without restarting its animation clock or remounting the hands. Static/no-WebGL hand artwork uses the same theme tokens. Existing ecosystem artwork is not recolored.

## Validation

`apps/web/tests/landing-theme-browser.ts` runs against a loopback preview selected with `FLINCH_THEME_URL`. It checks five responsive widths, identical light/dark geometry and hero SVG markup, opaque-surface text contrast, keyboard operation, reload, cross-tab and system preferences, native disclosures, rules focus, the Glimm overlay, live reduced motion, denied storage/WebGL, no-JavaScript content, footer GPU colors, preserved scroll, and arena isolation.

Unit tests cover preference parsing/bootstrap, midpoint and cancellation semantics, allocation failures, palette refresh without animation reset, dark text pairs, bento gradient endpoints, and a conservative FAQ flow contrast bound. The browser's ancestor-background contrast calculation marks gradients and sibling plot fills separately; it is not a screenshot-based proof of every animated pixel.

The existing bento harness waits for the asynchronous reduced-motion preference update before taking its offscreen phase baseline. Previously it could compare the old static illustration phases to the normal initial phases and report movement while nothing was running.

Verified against the isolated production preview on 2026-09-11:

- Frontend unit suite: 450 tests across 43 files passed.
- Root and frontend type checks, production build, brand parity, source constraints, and selected secret/generated-artifact checks passed.
- Landing themes: `artifacts/runs/landing-theme-1789077638725/result.json`.
- Existing landing and 404: `artifacts/runs/landing-1789077355753/result.json`.
- Footer: `artifacts/runs/footer-browser-1789077405150/result.json`.
- Bento motion and seven-width bounds: `artifacts/runs/bento-1789077640063/result.json`.
- FAQ interactions and animation: `artifacts/runs/faq-1789077785629/result.json`.

This UI work does not establish devnet deployment, actual wallet transactions, the ten-round protocol gate, physical-device performance, or Safari/Firefox coverage.
