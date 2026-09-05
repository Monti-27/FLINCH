use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};
use ephemeral_rollups_sdk::consts::{DELEGATION_PROGRAM_ID, ESPL_TOKEN_PROGRAM_ID};

use crate::constants::{ROUND_SEED, WSOL_MINT};
use crate::domain::RoundConfig;
use crate::error::FlinchError;
use crate::events::RoundCreated;
use crate::integrations::espl::{self, PoolCustodyAccounts};
use crate::state::Round;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeRoundArgs {
    pub host_nonce: u64,
    pub validator: Pubkey,
    pub stake: u64,
    pub funding_deadline: i64,
    pub price_account: Pubkey,
    pub price_feed_id: [u8; 32],
}

#[derive(Accounts)]
#[instruction(args: InitializeRoundArgs)]
pub struct InitializeRound<'info> {
    #[account(mut)]
    pub host: Signer<'info>,
    #[account(address = WSOL_MINT @ FlinchError::InvalidMint)]
    pub mint: Box<Account<'info, Mint>>,
    #[account(
        init,
        payer = host,
        space = 8 + Round::INIT_SPACE,
        seeds = [ROUND_SEED, host.key().as_ref(), args.host_nonce.to_le_bytes().as_ref()],
        bump
    )]
    pub round: Box<Account<'info, Round>>,
    #[account(
        init,
        payer = host,
        associated_token::mint = mint,
        associated_token::authority = round
    )]
    pub pool_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = espl::ephemeral_ata(&round.key(), &mint.key()) @ FlinchError::InvalidTokenAccount
    )]
    pub pool_ephemeral_ata: UncheckedAccount<'info>,
    #[account(
        mut,
        address = espl::global_vault(&mint.key()) @ FlinchError::InvalidTokenAccount
    )]
    pub global_vault: UncheckedAccount<'info>,
    #[account(
        mut,
        address = espl::ephemeral_ata(&global_vault.key(), &mint.key()) @ FlinchError::InvalidTokenAccount
    )]
    pub vault_ephemeral_ata: UncheckedAccount<'info>,
    #[account(
        mut,
        address = espl::vault_token_account(&mint.key()) @ FlinchError::InvalidTokenAccount
    )]
    pub vault_token_account: UncheckedAccount<'info>,
    #[account(
        mut,
        address = espl::delegation_buffer(&pool_ephemeral_ata.key()) @ FlinchError::InvalidTokenAccount
    )]
    pub pool_delegation_buffer: UncheckedAccount<'info>,
    #[account(
        mut,
        address = espl::delegation_record(&pool_ephemeral_ata.key()) @ FlinchError::InvalidTokenAccount
    )]
    pub pool_delegation_record: UncheckedAccount<'info>,
    #[account(
        mut,
        address = espl::delegation_metadata(&pool_ephemeral_ata.key()) @ FlinchError::InvalidTokenAccount
    )]
    pub pool_delegation_metadata: UncheckedAccount<'info>,
    #[account(
        mut,
        address = espl::delegation_buffer(&vault_ephemeral_ata.key()) @ FlinchError::InvalidTokenAccount
    )]
    pub vault_delegation_buffer: UncheckedAccount<'info>,
    #[account(
        mut,
        address = espl::delegation_record(&vault_ephemeral_ata.key()) @ FlinchError::InvalidTokenAccount
    )]
    pub vault_delegation_record: UncheckedAccount<'info>,
    #[account(
        mut,
        address = espl::delegation_metadata(&vault_ephemeral_ata.key()) @ FlinchError::InvalidTokenAccount
    )]
    pub vault_delegation_metadata: UncheckedAccount<'info>,
    #[account(address = ESPL_TOKEN_PROGRAM_ID)]
    pub ephemeral_token_program: UncheckedAccount<'info>,
    #[account(address = DELEGATION_PROGRAM_ID)]
    pub delegation_program: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializeRound>, args: InitializeRoundArgs) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    {
        let round = &mut ctx.accounts.round;
        round.configure(RoundConfig {
            host: ctx.accounts.host.key(),
            host_nonce: args.host_nonce,
            mint: ctx.accounts.mint.key(),
            validator: args.validator,
            pool_token_account: ctx.accounts.pool_token_account.key(),
            price_account: args.price_account,
            price_feed_id: args.price_feed_id,
            stake: args.stake,
            created_at: now,
            funding_deadline: args.funding_deadline,
            bump: ctx.bumps.round,
        })?;
    }
    espl::initialize_pool_custody(
        PoolCustodyAccounts {
            payer: &ctx.accounts.host,
            owner: ctx.accounts.round.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            pool_ephemeral_ata: ctx.accounts.pool_ephemeral_ata.to_account_info(),
            global_vault: ctx.accounts.global_vault.to_account_info(),
            vault_ephemeral_ata: ctx.accounts.vault_ephemeral_ata.to_account_info(),
            vault_token_account: ctx.accounts.vault_token_account.to_account_info(),
            pool_delegation_buffer: ctx.accounts.pool_delegation_buffer.to_account_info(),
            pool_delegation_record: ctx.accounts.pool_delegation_record.to_account_info(),
            pool_delegation_metadata: ctx.accounts.pool_delegation_metadata.to_account_info(),
            vault_delegation_buffer: ctx.accounts.vault_delegation_buffer.to_account_info(),
            vault_delegation_record: ctx.accounts.vault_delegation_record.to_account_info(),
            vault_delegation_metadata: ctx.accounts.vault_delegation_metadata.to_account_info(),
            ephemeral_token_program: ctx.accounts.ephemeral_token_program.to_account_info(),
            delegation_program: ctx.accounts.delegation_program.to_account_info(),
            token_program: ctx.accounts.token_program.to_account_info(),
            associated_token_program: ctx.accounts.associated_token_program.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
        },
        args.validator,
    )?;
    let round = &ctx.accounts.round;
    emit!(RoundCreated {
        round: round.key(),
        host: round.host,
        stake: round.stake,
        funding_deadline: round.funding_deadline,
        validator: round.validator,
    });
    Ok(())
}
