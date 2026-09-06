use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{
    constants::*,
    error::{DomainResult, FlinchError},
    integrations::custody,
    state::*,
};

#[derive(Accounts)]
pub struct ClaimTokens<'info> {
    pub player: Signer<'info>,
    #[account(mut, seeds = [LEDGER_SEED, ledger.host.as_ref(), &ledger.nonce.to_le_bytes()], bump = ledger.bump)]
    pub ledger: Account<'info, RoomLedger>,
    pub mint: Account<'info, Mint>,
    #[account(mut, associated_token::mint = mint, associated_token::authority = ledger)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, associated_token::mint = mint, associated_token::authority = player)]
    pub destination: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_claim(ctx: Context<ClaimTokens>, wsol: bool) -> Result<()> {
    let expected_mint = if wsol { WSOL_MINT } else { USDC_MINT };
    require_keys_eq!(
        ctx.accounts.mint.key(),
        expected_mint,
        FlinchError::InvalidMint
    );
    let ledger = &mut ctx.accounts.ledger;
    ledger.validate()?;
    let seat = ledger.seat(ctx.accounts.player.key())?;
    let (amount, liability) = if ledger.phase == RoomPhase::Cancelled && wsol {
        require!(!ledger.refunded[seat], FlinchError::NothingToClaim);
        let liability = ledger.funding_liability();
        ledger.refunded[seat] = true;
        (ledger.stake, liability)
    } else {
        let mut domain = ledger.domain(ledger.key())?;
        let accounting = domain.accounting().onchain()?;
        let (amount, liability) = if wsol {
            (
                domain.claim_wsol(seat).onchain()?,
                accounting.remaining_wsol,
            )
        } else {
            (
                domain.claim_usdc(seat).onchain()?,
                accounting.claimable_usdc,
            )
        };
        ledger.store(&domain);
        (amount, liability)
    };
    let before = ctx.accounts.vault.amount;
    let destination_before = ctx.accounts.destination.amount;
    require!(before >= liability, FlinchError::InsufficientCustody);
    let nonce = ledger.nonce.to_le_bytes();
    let bump = [ledger.bump];
    let seeds = [LEDGER_SEED, ledger.host.as_ref(), &nonce, &bump];
    custody::transfer(
        ctx.accounts.vault.to_account_info(),
        ctx.accounts.destination.to_account_info(),
        ctx.accounts.mint.to_account_info(),
        ledger.to_account_info(),
        amount,
        if wsol { 9 } else { 6 },
        &[&seeds],
    )?;
    ctx.accounts.vault.reload()?;
    ctx.accounts.destination.reload()?;
    custody::verify_delta(before, ctx.accounts.vault.amount, amount)?;
    custody::verify_delta(ctx.accounts.destination.amount, destination_before, amount)?;
    Ok(())
}
