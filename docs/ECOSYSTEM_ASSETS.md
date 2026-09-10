# Official ecosystem marks

Retrieved on 2026-09-08 for the user's request to replace generic protocol icons with official online assets. These marks identify the actual network, protocols and tokens; they do not imply endorsement or partnership. Trademark rights remain with their respective owners.

All assets are self-hosted under `apps/web/public/brand/ecosystem`. SVG geometry, gradients and fills are unchanged; only trailing whitespace is normalized. Raydium's PNG is unmodified. No SVG scripts, external references or embedded images are included. The application makes no third-party image requests for these marks.

| Asset | Official source | File |
| --- | --- | --- |
| Solana | [Branding page](https://solana.com/branding), [logomark SVG](https://solana.com/src/img/branding/solanaLogoMark.svg) | `solana.svg` |
| MagicBlock | [Brand assets page](https://www.magicblock.xyz/brand-asset-page) links to its [public kit](https://drive.google.com/drive/folders/1-BdkdHYddZ5Xt113vtLcVu1UixXrRSP7). Logos → SVG → [MagicBlock-Logomark-White.svg](https://drive.google.com/file/d/1WJkAbUmWkKgU7kNXhDk7NNocZDARkfjq/view) | `magicblock.svg` |
| Raydium | [Official documentation](https://docs.raydium.io/) references [raydium-r.png](https://mintlify.s3.us-west-1.amazonaws.com/raydium/logo/raydium-r.png) as its icon | `raydium.png` |
| USDC | [Circle pressroom brand kit](https://www.circle.com/pressroom#brandkit), [official USDC ZIP](https://6778953.fs1.hubspotusercontent-na1.net/hubfs/6778953/Pressroom/brandkit/logo-downloads/usdc.zip), `Token Logo/USDC Token.svg` | `usdc.svg` |

The white MagicBlock variant is supplied by the official kit, not a recolored approximation. Preserve official colors rather than applying the app's palette, filters or masks to third-party marks. Keep the original proportions using `object-fit: contain` within reserved 16/20/24px boxes. SHA-256 parity and SVG safety checks live in `apps/web/tests/ecosystem.test.tsx`.

`EcosystemIcon` is the shared presentation component. Footer documentation links and the protocol navigation use the same typed identity from `protocolLinks`. SOL/WSOL use the Solana mark but keep distinct written labels. USDC appears only for the USDC asset; the chart's USD reference is not labeled as USDC. Unknown token symbols do not receive a guessed icon. Icons alongside visible text or labeled links have empty alt text; standalone usage can supply a label.

This change replaces only the three generic icons in the footer toolbar. The centered FLINCH × Magicblocks typography, geometry, styling, shader and controls are preserved. The approved FLINCH identity is not replaced by an ecosystem mark. No wallet branding is invented; wallet icons remain owned by the Wallet Standard adapter.

The legacy Raydium app reference `https://raydium.io/logo/logo-only-icon.svg` returned 404 during research and is not used. The documentation-hosted PNG is the verified source.
