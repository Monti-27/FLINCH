use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{
    constants::*,
    error::{DomainResult, FlinchError},
    integrations::raydium,
    raydium_cp_swap::{
        self,
        accounts::{AmmConfig, ObservationState, PoolState},
    },
    state::*,
};

#[derive(Accounts)]
pub struct ExecuteBatch<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [LEDGER_SEED, ledger.host.as_ref(), &ledger.nonce.to_le_bytes()], bump = ledger.bump)]
    pub ledger: Box<Account<'info, RoomLedger>>,
    #[account(mut, seeds = [CONTROL_SEED, ledger.key().as_ref()], bump = control.bump)]
    pub control: Box<Account<'info, RoomControl>>,
    #[account(init, payer = payer, space = 8 + BatchReceipt::INIT_SPACE,
        seeds = [RECEIPT_SEED, ledger.key().as_ref(), &control.revision.to_le_bytes()], bump)]
    pub receipt: Box<Account<'info, BatchReceipt>>,
    #[account(address = WSOL_MINT)]
    pub wsol_mint: Box<Account<'info, Mint>>,
    #[account(address = USDC_MINT)]
    pub usdc_mint: Box<Account<'info, Mint>>,
    #[account(mut, associated_token::mint = wsol_mint, associated_token::authority = ledger)]
    pub wsol_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = ledger)]
    pub usdc_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, address = ledger.pool)]
    pub pool: AccountLoader<'info, PoolState>,
    pub amm_config: Box<Account<'info, AmmConfig>>,
    #[account(seeds = [b"vault_and_lp_mint_auth_seed"], bump, seeds::program = raydium_cp_swap::ID)]
    pub authority: UncheckedAccount<'info>,
    #[account(mut, token::mint = wsol_mint, token::authority = authority)]
    pub pool_wsol_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, token::mint = usdc_mint, token::authority = authority)]
    pub pool_usdc_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub observation: AccountLoader<'info, ObservationState>,
    #[account(address = raydium_cp_swap::ID, executable)]
    pub raydium_program: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handle_execute(ctx: Context<ExecuteBatch>) -> Result<()> {
    let room = &mut ctx.accounts.ledger;
    let mut domain = room.domain(room.key())?;
    let batch = ctx.accounts.control.batch(room, room.key(), &domain)?;
    let now = Clock::get()?.unix_timestamp;
    require!(
        now >= batch.window().closes_at()
            && now < batch.window().expires_at()
            && now < domain.recovery_at(),
        FlinchError::InvalidControl
    );
    {
        let pool = ctx.accounts.pool.load()?;
        raydium::validate_pool(&pool)?;
        let config = pool.amm_config;
        let observation = pool.observation_key;
        require_keys_eq!(
            config,
            ctx.accounts.amm_config.key(),
            FlinchError::InvalidPool
        );
        require_keys_eq!(
            observation,
            ctx.accounts.observation.key(),
            FlinchError::InvalidPool
        );
        let observation_pool = ctx.accounts.observation.load()?.pool_id;
        require_keys_eq!(observation_pool, room.pool, FlinchError::InvalidPool);
        let (input, output) = if pool.token_0_mint == WSOL_MINT {
            (pool.token_0_vault, pool.token_1_vault)
        } else {
            (pool.token_1_vault, pool.token_0_vault)
        };
        require_keys_eq!(
            input,
            ctx.accounts.pool_wsol_vault.key(),
            FlinchError::InvalidPool
        );
        require_keys_eq!(
            output,
            ctx.accounts.pool_usdc_vault.key(),
            FlinchError::InvalidPool
        );
        require!(
            pool.auth_bump == ctx.bumps.authority,
            FlinchError::InvalidPool
        );
    }
    let before_wsol = ctx.accounts.wsol_vault.amount;
    let before_usdc = ctx.accounts.usdc_vault.amount;
    let accounting = domain.accounting().onchain()?;
    require!(
        before_wsol >= accounting.remaining_wsol && before_usdc >= accounting.claimable_usdc,
        FlinchError::InsufficientCustody
    );
    let nonce = room.nonce.to_le_bytes();
    let bump = [room.bump];
    let seeds = [LEDGER_SEED, room.host.as_ref(), &nonce, &bump];
    let minimum = batch
        .minimum_outputs()
        .iter()
        .try_fold(0u64, |total, amount| total.checked_add(*amount))
        .ok_or(FlinchError::InvalidControl)?;
    raydium::swap(
        raydium_cp_swap::cpi::accounts::SwapBaseInput {
            payer: room.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
            amm_config: ctx.accounts.amm_config.to_account_info(),
            pool_state: ctx.accounts.pool.to_account_info(),
            input_token_account: ctx.accounts.wsol_vault.to_account_info(),
            output_token_account: ctx.accounts.usdc_vault.to_account_info(),
            input_vault: ctx.accounts.pool_wsol_vault.to_account_info(),
            output_vault: ctx.accounts.pool_usdc_vault.to_account_info(),
            input_token_program: ctx.accounts.token_program.to_account_info(),
            output_token_program: ctx.accounts.token_program.to_account_info(),
            input_token_mint: ctx.accounts.wsol_mint.to_account_info(),
            output_token_mint: ctx.accounts.usdc_mint.to_account_info(),
            observation_state: ctx.accounts.observation.to_account_info(),
        },
        &[&seeds],
        batch.economics().total_input(),
        minimum,
    )?;
    ctx.accounts.wsol_vault.reload()?;
    ctx.accounts.usdc_vault.reload()?;
    let input = before_wsol
        .checked_sub(ctx.accounts.wsol_vault.amount)
        .ok_or(FlinchError::TransferMismatch)?;
    let output = ctx
        .accounts
        .usdc_vault
        .amount
        .checked_sub(before_usdc)
        .ok_or(FlinchError::TransferMismatch)?;
    let allocations = domain.apply_fill(&batch, input, output, now).onchain()?;
    let after = domain.accounting().onchain()?;
    require!(
        ctx.accounts.wsol_vault.amount >= after.remaining_wsol
            && ctx.accounts.usdc_vault.amount >= after.claimable_usdc,
        FlinchError::InsufficientCustody
    );
    ctx.accounts.receipt.set_inner(BatchReceipt {
        version: VERSION,
        ledger: room.key(),
        revision: batch.revision(),
        sellers: batch.sellers().bitmap(),
        cohort_index: batch.window().index(),
        expired: false,
        executed_at: now,
        input,
        output,
        allocations,
    });
    room.store(&domain);
    ctx.accounts.control.resolve(&domain);
    Ok(())
}
