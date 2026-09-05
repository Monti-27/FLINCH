use anchor_lang::prelude::*;
use anchor_spl::associated_token::get_associated_token_address;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::error::FlinchError;
use crate::events::SellerPaid;
use crate::instructions::token_transfer;
use crate::state::{PlayerStatus, Round};

#[derive(Accounts)]
pub struct SettlePlayer<'info> {
    pub payer: Signer<'info>,
    pub player: UncheckedAccount<'info>,
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
        address = get_associated_token_address(&player.key(), &round.mint) @ FlinchError::InvalidTokenAccount,
        constraint = player_token_account.owner == player.key() @ FlinchError::InvalidTokenAccount,
        constraint = player_token_account.mint == round.mint @ FlinchError::InvalidMint
    )]
    pub player_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<SettlePlayer>) -> Result<()> {
    let round_key = ctx.accounts.round.key();
    ctx.accounts.round.assert_address(round_key)?;
    let index = ctx.accounts.round.player_index(ctx.accounts.player.key())?;
    let player = ctx.accounts.round.players[index];
    require!(
        player.status == PlayerStatus::Sold,
        FlinchError::PayoutNotAvailable
    );
    require!(!player.payout_claimed, FlinchError::PayoutAlreadyClaimed);
    require_keys_eq!(
        player.token_account,
        ctx.accounts.player_token_account.key(),
        FlinchError::InvalidTokenAccount
    );
    let host = ctx.accounts.round.host;
    let host_nonce = ctx.accounts.round.host_nonce;
    let bump = ctx.accounts.round.bump;
    token_transfer::from_round(token_transfer::RoundTransfer {
        authority: ctx.accounts.round.to_account_info(),
        from: ctx.accounts.pool_token_account.to_account_info(),
        to: ctx.accounts.player_token_account.to_account_info(),
        token_program: &ctx.accounts.token_program,
        host,
        host_nonce,
        bump,
        amount: player.payout,
    })?;
    let round = &mut ctx.accounts.round;
    round.players[index].payout_claimed = true;
    round.total_paid = round
        .total_paid
        .checked_add(player.payout)
        .ok_or(FlinchError::MathOverflow)?;
    emit!(SellerPaid {
        round: round_key,
        player: player.wallet,
        rank: player.sell_rank,
        penalty: player.penalty_paid,
        payout: player.payout,
    });
    Ok(())
}
