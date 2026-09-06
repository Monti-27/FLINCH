use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{constants::*, error::FlinchError, integrations::custody, state::*};

#[derive(Accounts)]
pub struct JoinRoom<'info> {
    pub player: Signer<'info>,
    #[account(mut, seeds = [LEDGER_SEED, ledger.host.as_ref(), &ledger.nonce.to_le_bytes()], bump = ledger.bump)]
    pub ledger: Account<'info, RoomLedger>,
    #[account(address = WSOL_MINT)]
    pub mint: Account<'info, Mint>,
    #[account(mut, associated_token::mint = mint, associated_token::authority = player)]
    pub source: Account<'info, TokenAccount>,
    #[account(mut, associated_token::mint = mint, associated_token::authority = ledger)]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_join(ctx: Context<JoinRoom>) -> Result<()> {
    let ledger = &mut ctx.accounts.ledger;
    ledger.validate()?;
    require!(ledger.phase == RoomPhase::Funding, FlinchError::WrongPhase);
    require!(
        Clock::get()?.unix_timestamp < ledger.funding_deadline,
        FlinchError::FundingExpired
    );
    require!(
        !ledger.wallets.contains(&ctx.accounts.player.key()),
        FlinchError::DuplicateWallet
    );
    let seat = ledger
        .wallets
        .iter()
        .position(|key| *key == Pubkey::default())
        .ok_or(FlinchError::RoomFull)?;
    let before = ctx.accounts.vault.amount;
    let source_before = ctx.accounts.source.amount;
    custody::transfer(
        ctx.accounts.source.to_account_info(),
        ctx.accounts.vault.to_account_info(),
        ctx.accounts.mint.to_account_info(),
        ctx.accounts.player.to_account_info(),
        ledger.stake,
        9,
        &[],
    )?;
    ctx.accounts.vault.reload()?;
    ctx.accounts.source.reload()?;
    custody::verify_delta(source_before, ctx.accounts.source.amount, ledger.stake)?;
    custody::verify_delta(ctx.accounts.vault.amount, before, ledger.stake)?;
    ledger.wallets[seat] = ctx.accounts.player.key();
    require!(
        ctx.accounts.vault.amount >= ledger.funding_liability(),
        FlinchError::InsufficientCustody
    );
    Ok(())
}
