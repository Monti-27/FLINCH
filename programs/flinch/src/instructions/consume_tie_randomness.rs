use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::vrf_callback;

use crate::events::CohortResolved;
use crate::state::Round;

#[vrf_callback]
#[derive(Accounts)]
pub struct ConsumeTieRandomness<'info> {
    #[account(mut)]
    pub round: Account<'info, Round>,
}

pub fn handler(
    ctx: Context<ConsumeTieRandomness>,
    randomness: [u8; 32],
    request_nonce: u64,
) -> Result<()> {
    let round_key = ctx.accounts.round.key();
    ctx.accounts.round.assert_address(round_key)?;
    let summary = ctx.accounts.round.resolve_vrf(request_nonce, randomness)?;
    emit!(CohortResolved {
        round: round_key,
        cohort: summary.cohort_index,
        seller_bitmap: summary.seller_bitmap,
        used_vrf: true,
        timed_out: false,
    });
    Ok(())
}
