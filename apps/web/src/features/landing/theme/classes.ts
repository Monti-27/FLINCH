export const landingThemeClasses = `group/landing scheme-light
  data-[landing-theme=dark]:scheme-dark
  data-[landing-theme=dark]:[--paper:var(--color-shadow-grey-900)]!
  data-[landing-theme=dark]:[--paper-raised:var(--color-shadow-grey-950)]!
  data-[landing-theme=dark]:[--paper-inset:var(--color-shadow-grey-800)]!
  data-[landing-theme=dark]:[--ink:var(--color-alabaster-grey-50)]!
  data-[landing-theme=dark]:[--ink-soft:var(--color-alabaster-grey-300)]!
  data-[landing-theme=dark]:[--paper-accent:var(--color-twilight-indigo-300)]!
  data-[landing-theme=dark]:selection:bg-(--color-twilight-indigo-800)!
  data-[landing-theme=dark]:selection:text-(--color-alabaster-grey-50)!
  data-[landing-theme=dark]:[&_.app-footer]:border-t!
  data-[landing-theme=dark]:[&_.app-footer]:border-(--paper-line)!
  data-[landing-theme=dark]:[&_.app-footer]:[--footer-surface:var(--paper-raised)]!
  data-[landing-theme=dark]:[&_.app-footer]:[--brand-mark-color:var(--color-alabaster-grey-100)]!
  data-[landing-theme=dark]:[&_.app-footer]:[--footer-copy:var(--footer-text)]!
  data-[landing-theme=dark]:[&_.app-footer]:[--footer-heading:var(--footer-pale)]!
  data-[landing-theme=dark]:[&_.app-footer]:[--footer-secondary:var(--muted-foreground)]!
  data-[landing-theme=dark]:[&_.app-footer]:[--footer-center-a:var(--color-twilight-indigo-200)]!
  data-[landing-theme=dark]:[&_.app-footer]:[--footer-center-b:var(--hand-ice)]!
  data-[landing-theme=dark]:[&_.app-footer]:[--hand-silver:#bdc7d5]!
  data-[landing-theme=dark]:[&_.app-footer]:[--hand-coral:#ec967a]!
  data-[landing-theme=dark]:[&_.app-footer]:[--hand-violet:#af94ed]!
  data-[landing-theme=dark]:[&_.app-footer]:[--hand-ice:#75d5db]!
  data-[landing-theme=dark]:[&_[data-faq]]:[--faq-text:var(--color-alabaster-grey-200)]!
  data-[landing-theme=dark]:[&_[data-faq]]:[--faq-icon:var(--color-alabaster-grey-300)]!
  data-[landing-theme=dark]:[&_[data-faq]]:[--faq-blue:var(--color-twilight-indigo-800)]!
  data-[landing-theme=dark]:[&_[data-faq]]:[--faq-amber:var(--color-shadow-grey-700)]!
  data-[landing-theme=dark]:[&_[data-faq]]:[--faq-red:var(--color-twilight-indigo-900)]!
  data-[landing-theme=dark]:[&_[data-custody-scene]]:[--chip-edge:var(--color-shadow-grey-600)]!
  data-[landing-theme=dark]:[&_[data-stake-chip]]:bg-[linear-gradient(145deg,var(--bento-sheet)_30%,var(--color-shadow-grey-700))]!
  data-[landing-theme=dark]:[&_[data-seller=true]]:bg-(--color-shadow-grey-500)!
  data-[landing-theme=dark]:[&_[data-bento-card=holders]]:[--bento-blue-soft:var(--color-twilight-indigo-300)]!`;

export const darkActionHover = "group-data-[landing-theme=dark]/landing:hover:bg-(--color-alabaster-grey-200)!";

export const bentoThemeClasses = `group-data-[landing-theme=dark]/landing:[--bento-surface:var(--color-shadow-grey-900)]!
  group-data-[landing-theme=dark]/landing:[--bento-sheet:var(--color-shadow-grey-800)]!
  group-data-[landing-theme=dark]/landing:[--bento-blue-soft:var(--color-twilight-indigo-800)]!
  group-data-[landing-theme=dark]/landing:[--bento-line:color-mix(in_srgb,var(--ink)_10%,transparent)]!
  group-data-[landing-theme=dark]/landing:[--bento-shadow:0_8px_24px_#00000030,0_1px_3px_#00000020]!`;

export const decisionThemeClasses = `group-data-[landing-theme=dark]/landing:bg-[linear-gradient(180deg,var(--color-twilight-indigo-900),var(--bento-surface)_65%,transparent)]!
  group-data-[landing-theme=dark]/landing:[&>div:first-child]:text-(--color-twilight-indigo-200)!
  group-data-[landing-theme=dark]/landing:[&>div:nth-child(2)]:text-(--ink)!`;

export const rollupThemeClasses = `group-data-[landing-theme=dark]/landing:[&_[data-rollup-rail]]:bg-(--color-twilight-indigo-800)!
  group-data-[landing-theme=dark]/landing:[&_[data-rollup-backplate]]:bg-(--color-twilight-indigo-900)!
  group-data-[landing-theme=dark]/landing:[&_[data-rollup-backplate]]:shadow-[0_1px_0_var(--color-twilight-indigo-800)]!
  group-data-[landing-theme=dark]/landing:[&_[data-rollup-highlight]]:bg-(--color-twilight-indigo-900)!`;
