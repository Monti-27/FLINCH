# FLINCH product

Four friends stake equal WSOL. Selling exchanges a player's position for test USDC and pays a small WSOL penalty to the others who held. A natural last holder wins; if time expires with multiple holders, they keep their holdings. No forced lottery or protocol rake.

Build for a short, understandable hackathon demonstration, not professional trading. The live room makes queued sells and growing holder positions visible. SELL is pending until its actual Solana swap confirms; claims are a later, separately confirmed wallet action.

Use Circle devnet USDC and a funded Raydium devnet pool. All assets are valueless test assets. Pool quotes, price impact and fees are real properties of that test pool; live SOL/USD is separate reference information. Do not promise real-dollar returns, instant fills or guaranteed availability.

Success: one human and three ordinary bot wallets can complete the entire flow, understand failed sells and standoffs, claim the correct amounts, and inspect signatures. Ten sequential rounds without manual repair, not extra features, is the delivery target.

Detailed rules are in [GAME_RULES.md](GAME_RULES.md); implementation order and cut lines are in [BUILD_PLAN.md](BUILD_PLAN.md).
