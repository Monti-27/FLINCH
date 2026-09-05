use anchor_lang::prelude::*;
use anchor_spl::associated_token::get_associated_token_address;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::error::FlinchError;
use crate::events::PlayerJoined;
use crate::state::Round;

#[derive(Accounts)]
pub struct Join<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    #[account(mut)]
    pub round: Box<Account<'info, Round>>,
    #[account(address = round.mint @ FlinchError::InvalidMint)]
    pub mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        address = get_associated_token_address(&player.key(), &round.mint) @ FlinchError::InvalidTokenAccount,
        constraint = player_token_account.owner == player.key() @ FlinchError::InvalidTokenAccount,
        constraint = player_token_account.mint == round.mint @ FlinchError::InvalidMint
    )]
    pub player_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = round.pool_token_account @ FlinchError::InvalidTokenAccount,
        constraint = pool_token_account.owner == round.key() @ FlinchError::InvalidTokenAccount,
        constraint = pool_token_account.mint == round.mint @ FlinchError::InvalidMint
    )]
    pub pool_token_account: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<Join>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let stake = ctx.accounts.round.stake;
    require!(
        ctx.accounts.player_token_account.amount >= stake,
        FlinchError::InvalidTokenAmount
    );
    let cpi_accounts = Transfer {
        from: ctx.accounts.player_token_account.to_account_info(),
        to: ctx.accounts.pool_token_account.to_account_info(),
        authority: ctx.accounts.player.to_account_info(),
    };
    token::transfer(
        CpiContext::new(ctx.accounts.token_program.key(), cpi_accounts),
        stake,
    )?;
    let round = &mut ctx.accounts.round;
    round.assert_address(round.key())?;
    let seat = round.add_player(
        ctx.accounts.player.key(),
        ctx.accounts.player_token_account.key(),
        now,
    )?;
    emit!(PlayerJoined {
        round: round.key(),
        player: ctx.accounts.player.key(),
        seat,
        stake,
    });
    Ok(())
}
