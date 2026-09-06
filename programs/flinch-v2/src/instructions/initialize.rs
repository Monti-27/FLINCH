use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

use crate::{
    constants::*, error::FlinchError, integrations::raydium::validate_pool,
    raydium_cp_swap::accounts::PoolState, state::*,
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeArgs {
    pub nonce: u64,
    pub stake: u64,
    pub validator: Pubkey,
}

#[derive(Accounts)]
#[instruction(args: InitializeArgs)]
pub struct InitializeRoom<'info> {
    #[account(mut)]
    pub host: Signer<'info>,
    #[account(init, payer = host, space = 8 + RoomLedger::INIT_SPACE,
        seeds = [LEDGER_SEED, host.key().as_ref(), &args.nonce.to_le_bytes()], bump)]
    pub ledger: Account<'info, RoomLedger>,
    pub pool: AccountLoader<'info, PoolState>,
    #[account(address = WSOL_MINT, constraint = wsol_mint.decimals == 9 @ FlinchError::InvalidMint)]
    pub wsol_mint: Account<'info, Mint>,
    #[account(address = USDC_MINT, constraint = usdc_mint.decimals == 6 @ FlinchError::InvalidMint)]
    pub usdc_mint: Account<'info, Mint>,
    #[account(init_if_needed, payer = host, associated_token::mint = wsol_mint, associated_token::authority = ledger)]
    pub wsol_vault: Account<'info, TokenAccount>,
    #[account(init_if_needed, payer = host, associated_token::mint = usdc_mint, associated_token::authority = ledger)]
    pub usdc_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handle_initialize(ctx: Context<InitializeRoom>, args: InitializeArgs) -> Result<()> {
    require!(
        (MIN_STAKE..=MAX_STAKE).contains(&args.stake),
        FlinchError::InvalidConfiguration
    );
    require!(
        args.validator != Pubkey::default(),
        FlinchError::InvalidConfiguration
    );
    let now = Clock::get()?.unix_timestamp;
    require!(now >= 0, FlinchError::InvalidConfiguration);
    validate_pool(&*ctx.accounts.pool.load()?)?;
    ctx.accounts.ledger.set_inner(RoomLedger {
        version: VERSION,
        bump: ctx.bumps.ledger,
        host: ctx.accounts.host.key(),
        nonce: args.nonce,
        validator: args.validator,
        pool: ctx.accounts.pool.key(),
        stake: args.stake,
        funding_deadline: now
            .checked_add(FUNDING_SECONDS)
            .ok_or(FlinchError::InvalidConfiguration)?,
        phase: RoomPhase::Funding,
        wallets: [Pubkey::default(); 4],
        session_signers: [Pubkey::default(); 4],
        refunded: [false; 4],
        economics: None,
    });
    Ok(())
}
