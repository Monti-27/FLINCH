use anchor_lang::prelude::*;

use crate::events::CohortResolved;
use crate::state::Round;

#[derive(Accounts)]
pub struct ResolveTieTimeout<'info> {
    pub payer: Signer<'info>,
    #[account(mut)]
    pub round: Account<'info, Round>,
}

pub fn handler(ctx: Context<ResolveTieTimeout>) -> Result<()> {
    let round_key = ctx.accounts.round.key();
    ctx.accounts.round.assert_address(round_key)?;
    let summary = ctx
        .accounts
        .round
        .resolve_vrf_timeout(Clock::get()?.unix_timestamp)?;
    emit!(CohortResolved {
        round: round_key,
        cohort: summary.cohort_index,
        seller_bitmap: summary.seller_bitmap,
        used_vrf: false,
        timed_out: true,
    });
    Ok(())
}
