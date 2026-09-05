use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;
use ephemeral_rollups_sdk::anchor::commit;
use ephemeral_rollups_sdk::ephem::{FoldableIntentBuilder, MagicIntentBundleBuilder};

use crate::domain::funded_pool;
use crate::error::FlinchError;
use crate::state::{Round, RoundStatus};

#[commit]
#[derive(Accounts)]
pub struct CommitRound<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub round: Account<'info, Round>,
    #[account(
        address = round.pool_token_account @ FlinchError::InvalidTokenAccount,
        constraint = pool_token_account.owner == round.key() @ FlinchError::InvalidTokenAccount,
        constraint = pool_token_account.mint == round.mint @ FlinchError::InvalidMint
    )]
    pub pool_token_account: Account<'info, TokenAccount>,
}

pub fn handler(ctx: Context<CommitRound>) -> Result<()> {
    let round = &ctx.accounts.round;
    round.assert_address(round.key())?;
    require!(
        matches!(round.status, RoundStatus::Settled | RoundStatus::Cancelled),
        FlinchError::RoundNotFinalizable
    );
    require!(
        ctx.accounts.pool_token_account.amount == 0,
        FlinchError::PoolNotEmpty
    );
    let expected_total = if round.status == RoundStatus::Settled {
        funded_pool(round.stake)?
    } else {
        round.expected_cancelled_total()?
    };
    require!(
        round.total_paid == expected_total,
        FlinchError::ConservationViolation
    );
    MagicIntentBundleBuilder::new(
        ctx.accounts.payer.to_account_info(),
        ctx.accounts.magic_context.to_account_info(),
        ctx.accounts.magic_program.to_account_info(),
    )
    .commit_and_undelegate(&[ctx.accounts.round.to_account_info()])
    .build_and_invoke()?;
    Ok(())
}
