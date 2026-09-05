use anchor_lang::prelude::*;
use anchor_lang::Discriminator;
use ephemeral_rollups_sdk::{
    anchor::vrf,
    vrf::{
        self,
        instructions::{create_request_randomness_ix, RequestRandomnessParams},
        types::SerializableAccountMeta,
    },
};

use crate::domain::ResolutionOutcome;
use crate::error::FlinchError;
use crate::events::{CohortResolved, TieRequested};
use crate::state::Round;

#[vrf]
#[derive(Accounts)]
pub struct ResolveCohort<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub round: Account<'info, Round>,
    #[account(
        mut,
        constraint = oracle_queue.key() == vrf::consts::DEFAULT_EPHEMERAL_QUEUE
            || oracle_queue.key() == vrf::consts::DEFAULT_EPHEMERAL_TEST_QUEUE
            @ FlinchError::InvalidVrfQueue
    )]
    pub oracle_queue: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<ResolveCohort>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let round_key = ctx.accounts.round.key();
    ctx.accounts.round.assert_address(round_key)?;
    match ctx.accounts.round.prepare_resolution(now)? {
        ResolutionOutcome::Direct {
            cohort_index,
            seller_bitmap,
        } => {
            emit!(CohortResolved {
                round: round_key,
                cohort: cohort_index,
                seller_bitmap,
                used_vrf: false,
                timed_out: false,
            });
        }
        ResolutionOutcome::VrfRequested {
            cohort_index,
            seller_bitmap: _,
            request_nonce,
        } => {
            let mut caller_seed = round_key.to_bytes();
            for (index, value) in request_nonce.to_le_bytes().iter().enumerate() {
                caller_seed[index] ^= value;
            }
            for (index, value) in cohort_index.to_le_bytes().iter().enumerate() {
                caller_seed[index + 8] ^= value;
            }
            let instruction = create_request_randomness_ix(RequestRandomnessParams {
                payer: ctx.accounts.payer.key(),
                oracle_queue: ctx.accounts.oracle_queue.key(),
                callback_program_id: crate::ID,
                callback_discriminator: crate::instruction::ConsumeTieRandomness::DISCRIMINATOR
                    .to_vec(),
                caller_seed,
                accounts_metas: Some(vec![SerializableAccountMeta {
                    pubkey: round_key,
                    is_signer: false,
                    is_writable: true,
                }]),
                callback_args: Some(request_nonce.to_le_bytes().to_vec()),
            });
            ctx.accounts
                .invoke_signed_vrf(&ctx.accounts.payer.to_account_info(), &instruction)?;
            emit!(TieRequested {
                round: round_key,
                cohort: cohort_index,
                request_nonce,
            });
        }
        ResolutionOutcome::Finalizing => {}
    }
    Ok(())
}
