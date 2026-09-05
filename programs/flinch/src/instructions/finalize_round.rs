use anchor_lang::prelude::*;
use anchor_spl::associated_token::get_associated_token_address;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::domain::funded_pool;
use crate::error::FlinchError;
use crate::events::RoundSettled;
use crate::instructions::token_transfer;
use crate::state::{PlayerStatus, Round, RoundStatus};

#[derive(Accounts)]
pub struct FinalizeRound<'info> {
    pub payer: Signer<'info>,
    pub holder: UncheckedAccount<'info>,
    #[account(mut)]
    pub round: Account<'info, Round>,
    #[account(address = round.mint @ FlinchError::InvalidMint)]
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        address = round.pool_token_account @ FlinchError::InvalidTokenAccount,
        constraint = pool_token_account.owner == round.key() @ FlinchError::InvalidTokenAccount,
        constraint = pool_token_account.mint == round.mint @ FlinchError::InvalidMint
    )]
    pub pool_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        address = get_associated_token_address(&holder.key(), &round.mint) @ FlinchError::InvalidTokenAccount,
        constraint = holder_token_account.owner == holder.key() @ FlinchError::InvalidTokenAccount,
        constraint = holder_token_account.mint == round.mint @ FlinchError::InvalidMint
    )]
    pub holder_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<FinalizeRound>) -> Result<()> {
    let round_key = ctx.accounts.round.key();
    ctx.accounts.round.assert_address(round_key)?;
    require!(
        ctx.accounts.round.status == RoundStatus::Finalizing,
        FlinchError::RoundNotFinalizable
    );
    let index = ctx.accounts.round.player_index(ctx.accounts.holder.key())?;
    let holder = ctx.accounts.round.players[index];
    require!(
        holder.status == PlayerStatus::FinalHolder,
        FlinchError::RoundNotFinalizable
    );
    require!(!holder.payout_claimed, FlinchError::PayoutAlreadyClaimed);
    require_keys_eq!(
        holder.token_account,
        ctx.accounts.holder_token_account.key(),
        FlinchError::InvalidTokenAccount
    );
    require!(
        ctx.accounts
            .round
            .players
            .iter()
            .filter(|player| player.status == PlayerStatus::Sold)
            .all(|player| player.payout_claimed),
        FlinchError::PayoutNotAvailable
    );
    let amount = ctx.accounts.pool_token_account.amount;
    let expected = funded_pool(ctx.accounts.round.stake)?;
    let final_total = ctx
        .accounts
        .round
        .total_paid
        .checked_add(amount)
        .ok_or(FlinchError::MathOverflow)?;
    require!(final_total == expected, FlinchError::ConservationViolation);
    let host = ctx.accounts.round.host;
    let host_nonce = ctx.accounts.round.host_nonce;
    let bump = ctx.accounts.round.bump;
    token_transfer::from_round(token_transfer::RoundTransfer {
        authority: ctx.accounts.round.to_account_info(),
        from: ctx.accounts.pool_token_account.to_account_info(),
        to: ctx.accounts.holder_token_account.to_account_info(),
        token_program: &ctx.accounts.token_program,
        host,
        host_nonce,
        bump,
        amount,
    })?;
    let round = &mut ctx.accounts.round;
    round.players[index].payout = amount;
    round.players[index].payout_claimed = true;
    round.total_paid = final_total;
    round.terminal_pool_balance = 0;
    round.status = RoundStatus::Settled;
    emit!(RoundSettled {
        round: round_key,
        holder: holder.wallet,
        holder_payout: amount,
        total_paid: final_total,
    });
    Ok(())
}
