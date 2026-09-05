use anchor_lang::prelude::*;

use crate::events::RoundStarted;
use crate::state::Round;

#[derive(Accounts)]
pub struct StartRound<'info> {
    pub host: Signer<'info>,
    #[account(mut)]
    pub round: Account<'info, Round>,
}

pub fn handler(ctx: Context<StartRound>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let round = &mut ctx.accounts.round;
    round.assert_address(round.key())?;
    round.start(ctx.accounts.host.key(), now)?;
    emit!(RoundStarted {
        round: round.key(),
        started_at: round.started_at,
        ends_at: round.ends_at,
    });
    Ok(())
}
