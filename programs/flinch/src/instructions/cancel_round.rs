use anchor_lang::prelude::*;

use crate::events::RoundCancelled;
use crate::state::Round;

#[derive(Accounts)]
pub struct CancelRound<'info> {
    pub authority: Signer<'info>,
    #[account(mut)]
    pub round: Account<'info, Round>,
}

pub fn handler(ctx: Context<CancelRound>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let round = &mut ctx.accounts.round;
    round.assert_address(round.key())?;
    round.cancel(ctx.accounts.authority.key(), now)?;
    emit!(RoundCancelled {
        round: round.key(),
        authority: ctx.accounts.authority.key(),
        funded_count: round.funded_count,
    });
    Ok(())
}
