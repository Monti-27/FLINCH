use anchor_lang::prelude::*;
use session_keys::{Session, SessionTokenV2};

use crate::events::SellQueued;
use crate::state::Round;

#[derive(Accounts, Session)]
pub struct QueueSell<'info> {
    pub payer: Signer<'info>,
    pub user: UncheckedAccount<'info>,
    #[account(mut)]
    pub round: Account<'info, Round>,
    #[session(signer = payer, authority = user.key())]
    pub session_token: Option<Account<'info, SessionTokenV2>>,
}

pub fn handler(ctx: Context<QueueSell>, action_nonce: u64) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let round = &mut ctx.accounts.round;
    round.assert_address(round.key())?;
    let cohort = round.queue_sell(ctx.accounts.user.key(), action_nonce, now)?;
    emit!(SellQueued {
        round: round.key(),
        player: ctx.accounts.user.key(),
        cohort,
    });
    Ok(())
}
