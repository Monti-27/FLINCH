# Number animation

## Scope

The 2026-09-11 request combines NumberFlow rolling digits with brief green increases and red decreases. Both supplied snippets were identical. The controlled component lives at `apps/web/src/components/ui/count-down-numbers.tsx`; it receives real values rather than owning demo increment/decrement controls.

Live Coinbase reference prices, the loaded-window percentage, player WSOL/USDC amounts and current WSOL entitlement use it. Percentages keep their existing signed-window color rather than a second transient direction color. Editable stake inputs, signed minima, quote bounds, fee breakdowns, receipts and claim confirmations retain exact static text. The independently revised round timer is untouched. No fabricated observations, automatic signatures or changed settlement semantics are introduced.

## Integration

The existing app already has Next.js, strict TypeScript and Tailwind 4. Shared components belong in `apps/web/src/components/ui`, not a second `/components` tree at the workspace root. Keeping one folder makes generated imports and shared styling predictable. `components.json` points shadcn to this folder and `src/app/globals.css`; `@/*` resolves to `src/*`. The new Tailwind semantic aliases reference existing tokens without replacing the palette.

`@number-flow/react` 0.6.2 and `class-variance-authority` 0.7.1 were registry-checked and installed with lifecycle scripts disabled. Existing `lucide-react` 1.41.0 is reused. The supplied Badge API is available in `components/ui/badge.tsx`, styled with the existing semantic tokens. The development-only number fixture demonstrates controls and the badge without adding a public demo route.

```tsx
import AnimatedNumberCounter from "@/components/ui/count-down-numbers";

<AnimatedNumberCounter value={formatUnits(holding, 9)} identity={`${roomAddress}:${wallet}`} />
<AnimatedNumberCounter value={price?.toFixed(2)} prefix="$" />
```

## Precision and semantics

Token units stay bigint. Existing `formatUnits` supplies the complete decimal string; there is no conversion of token quantities to JavaScript Number. The component preserves up to 18 fractional places, including the entire u64 balance. NumberFlow 0.6.2 passes strings directly to `Intl.NumberFormat.formatToParts`. Its internal float is used for default motion direction, which this integration overrides with an exact bigint comparison. `src/types/intl.d.ts` supplies the standard decimal-string overload missing from the pinned TypeScript library declarations; it does not alter runtime behavior.

No grouping, abbreviation, zero subscripts or rounding is added to these exact quantity displays. This deliberately preserves the existing raw-unit contract rather than applying approximate compact formatting. Invalid/missing values show the existing dash with a no-data label; signed zero becomes unsigned. Number inputs outside the safe range or below supported precision are rejected rather than displayed as exact. Exact large or small quantities must arrive as strings or bigint.

## Motion policy

| Event | Result |
| --- | --- |
| First value or new identity | Immediate real value, neutral color |
| Changed value | 250ms interrupted digit roll; exact direction |
| Increase or decrease | Existing positive/negative token and a reserved-width arrow |
| Repeated update | Restart the one-second feedback window |
| Feedback ends | 100ms return to inherited text color |
| Missing/restored value | No invented zero or change signal |
| Reduced motion | Immediate digits; no roll or color pulse |
| Unmount | Cancel feedback timeout |

The library's live motion/support subscription is server-safe. Its accessible number label excludes the decorative arrow; no live announcement fires on every tick. Existing fonts and tabular numerals remain. Account/room identities reset previous-value comparisons. Financial source values change immediately; motion is presentation only.

## Checks

`apps/web/tests/number-value.test.tsx` covers exact comparison, normalization, u64 server rendering, smallest units, missing values, signs, affixes and repeated updates.

Run `FLINCH_BROWSER_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node apps/web/tests/number-browser.ts` from the workspace root for the isolated browser check. It uses the Vite runtime already installed with Vitest, no new application server or public route. Only Next Image is represented by a plain image adapter; token formatting aliases the actual client amount module to avoid booting protocol dependencies. Production rendering is checked separately.

The fixture has no wallet or live feed and makes no transactions. Its values are explicitly test data, not evidence of a protocol cycle. No public-devnet, real-wallet or full settlement proof is claimed by this presentation change.
