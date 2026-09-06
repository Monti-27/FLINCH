#![allow(clippy::diverging_sub_expression)]

pub mod constants;
pub mod error;
pub mod instructions;
pub mod integrations;
pub mod state;

use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::ephemeral;
pub use instructions::*;

#[cfg(not(feature = "devnet"))]
declare_id!("JDQgyFxwZJUpA31y2qhqhGgwfm5k7zANYUY1ctkqPB9y");
#[cfg(feature = "devnet")]
declare_id!("8mGLM6MoGgJBfJXAESN5C5fmKXCwnfinDGXX8drPFEie");
declare_program!(raydium_cp_swap);

#[ephemeral]
#[program]
pub mod flinch_v2 {
    use super::*;

    pub fn initialize_room(ctx: Context<InitializeRoom>, args: InitializeArgs) -> Result<()> {
        instructions::initialize::handle_initialize(ctx, args)
    }

    pub fn join_room(ctx: Context<JoinRoom>) -> Result<()> {
        instructions::join::handle_join(ctx)
    }

    pub fn cancel_room(ctx: Context<CancelRoom>) -> Result<()> {
        instructions::cancel::handle_cancel(ctx)
    }

    pub fn start_round(ctx: Context<StartRound>) -> Result<()> {
        instructions::start::handle_start(ctx)
    }

    pub fn recover_round(ctx: Context<RecoverRound>) -> Result<()> {
        instructions::recover::handle_recover(ctx)
    }

    pub fn claim_wsol(ctx: Context<ClaimTokens>) -> Result<()> {
        instructions::claim::handle_claim(ctx, true)
    }

    pub fn claim_usdc(ctx: Context<ClaimTokens>) -> Result<()> {
        instructions::claim::handle_claim(ctx, false)
    }

    pub fn execute_batch(ctx: Context<ExecuteBatch>) -> Result<()> {
        instructions::execute::handle_execute(ctx)
    }

    pub fn expire_batch(ctx: Context<ExpireBatch>) -> Result<()> {
        instructions::expire::handle_expire(ctx)
    }

    pub fn set_session_signer(ctx: Context<SetSessionSigner>, signer: Pubkey) -> Result<()> {
        instructions::session::handle_session(ctx, signer)
    }

    pub fn delegate_control(ctx: Context<DelegateControl>) -> Result<()> {
        instructions::delegate::handle_delegate(ctx)
    }

    pub fn queue_sell(
        ctx: Context<QueueSell>,
        seat: u8,
        nonce: u64,
        minimum_output: u64,
    ) -> Result<()> {
        instructions::queue::handle_queue(ctx, seat, nonce, minimum_output)
    }

    pub fn freeze_batch(ctx: Context<FreezeBatch>) -> Result<()> {
        instructions::freeze::handle_freeze(ctx)
    }
}
