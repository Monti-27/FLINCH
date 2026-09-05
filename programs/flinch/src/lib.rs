#![allow(clippy::diverging_sub_expression)]

pub mod constants;
pub mod domain;
pub mod error;
pub mod events;
pub mod instructions;
pub mod integrations;
pub mod state;

use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::ephemeral;
use session_keys::{session_auth_or, SessionError};

pub use instructions::*;

declare_id!("JDQgyFxwZJUpA31y2qhqhGgwfm5k7zANYUY1ctkqPB9y");

#[ephemeral]
#[program]
pub mod flinch {
    use super::*;

    pub fn initialize_round(
        ctx: Context<InitializeRound>,
        args: InitializeRoundArgs,
    ) -> Result<()> {
        instructions::initialize_round::handler(ctx, args)
    }

    pub fn delegate_round(
        ctx: Context<DelegateRound>,
        host_nonce: u64,
        validator: Pubkey,
    ) -> Result<()> {
        instructions::delegate_round::handler(ctx, host_nonce, validator)
    }

    pub fn join(ctx: Context<Join>) -> Result<()> {
        instructions::join::handler(ctx)
    }

    pub fn start_round(ctx: Context<StartRound>) -> Result<()> {
        instructions::start_round::handler(ctx)
    }

    pub fn cancel_round(ctx: Context<CancelRound>) -> Result<()> {
        instructions::cancel_round::handler(ctx)
    }

    #[session_auth_or(
        ctx.accounts.user.key() == ctx.accounts.payer.key(),
        SessionError::InvalidToken
    )]
    pub fn queue_sell(ctx: Context<QueueSell>, action_nonce: u64) -> Result<()> {
        instructions::queue_sell::handler(ctx, action_nonce)
    }

    pub fn resolve_cohort(ctx: Context<ResolveCohort>) -> Result<()> {
        instructions::resolve_cohort::handler(ctx)
    }

    pub fn consume_tie_randomness(
        ctx: Context<ConsumeTieRandomness>,
        randomness: [u8; 32],
        request_nonce: u64,
    ) -> Result<()> {
        instructions::consume_tie_randomness::handler(ctx, randomness, request_nonce)
    }

    pub fn resolve_tie_timeout(ctx: Context<ResolveTieTimeout>) -> Result<()> {
        instructions::resolve_tie_timeout::handler(ctx)
    }

    pub fn settle_player(ctx: Context<SettlePlayer>) -> Result<()> {
        instructions::settle_player::handler(ctx)
    }

    pub fn refund_player(ctx: Context<RefundPlayer>) -> Result<()> {
        instructions::refund_player::handler(ctx)
    }

    pub fn finalize_round(ctx: Context<FinalizeRound>) -> Result<()> {
        instructions::finalize_round::handler(ctx)
    }

    pub fn commit_round(ctx: Context<CommitRound>) -> Result<()> {
        instructions::commit_round::handler(ctx)
    }
}
