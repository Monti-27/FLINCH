use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, TokenAccount};
use flinch_domain::Ledger;

use crate::{
    constants::*,
    error::{DomainResult, FlinchError},
    state::*,
};

#[derive(Accounts)]
pub struct StartRound<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [LEDGER_SEED, ledger.host.as_ref(), &ledger.nonce.to_le_bytes()], bump = ledger.bump)]
    pub ledger: Account<'info, RoomLedger>,
    #[account(init, payer = payer, space = 8 + RoomControl::INIT_SPACE,
        seeds = [CONTROL_SEED, ledger.key().as_ref()], bump)]
    pub control: Account<'info, RoomControl>,
    #[account(address = WSOL_MINT)]
    pub mint: Account<'info, Mint>,
    #[account(associated_token::mint = mint, associated_token::authority = ledger)]
    pub vault: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
}

pub fn handle_start(ctx: Context<StartRound>) -> Result<()> {
    let ledger = &mut ctx.accounts.ledger;
    ledger.validate()?;
    require!(ledger.phase == RoomPhase::Funding, FlinchError::WrongPhase);
    let now = Clock::get()?.unix_timestamp;
    require!(now < ledger.funding_deadline, FlinchError::FundingExpired);
    require!(
        !ledger.wallets.contains(&Pubkey::default()),
        FlinchError::RoomNotFull
    );
    require!(
        ctx.accounts.vault.amount >= ledger.funding_liability(),
        FlinchError::InsufficientCustody
    );
    let domain = Ledger::new(ledger.key().to_bytes(), ledger.stake, now).onchain()?;
    ledger.phase = RoomPhase::Started;
    ledger.store(&domain);
    ctx.accounts.control.set_inner(RoomControl {
        version: VERSION,
        bump: ctx.bumps.control,
        ledger: ledger.key(),
        validator: ledger.validator,
        wallets: ledger.wallets,
        session_signers: ledger.session_signers,
        started_at: now,
        revision: 0,
        next_cohort: 0,
        holdings: domain.holdings(),
        phase: ControlPhase::Prepared,
        attempts: [0; 4],
        nonces: [0; 4],
        sellers: 0,
        cohort_index: 0,
        minimum_outputs: [0; 4],
    });
    Ok(())
}
