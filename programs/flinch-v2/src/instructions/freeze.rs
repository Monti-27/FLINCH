use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::{
    anchor::commit,
    ephem::{FoldableIntentBuilder, MagicIntentBundleBuilder},
};
use flinch_domain::CohortWindow;

use crate::{
    constants::*,
    error::{DomainResult, FlinchError},
    state::*,
};

#[commit]
#[derive(Accounts)]
pub struct FreezeBatch<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [CONTROL_SEED, control.ledger.as_ref()], bump = control.bump)]
    pub control: Account<'info, RoomControl>,
}

pub fn handle_freeze(ctx: Context<FreezeBatch>) -> Result<()> {
    let control = &mut ctx.accounts.control;
    require!(
        control.version == VERSION && control.phase == ControlPhase::Live && control.sellers != 0,
        FlinchError::InvalidControl
    );
    let window = CohortWindow::new(control.started_at, control.cohort_index).onchain()?;
    require!(
        Clock::get()?.unix_timestamp >= window.closes_at(),
        FlinchError::InvalidControl
    );
    control.phase = ControlPhase::Frozen;
    control.exit(ctx.program_id)?;
    MagicIntentBundleBuilder::new(
        ctx.accounts.payer.to_account_info(),
        ctx.accounts.magic_context.to_account_info(),
        ctx.accounts.magic_program.to_account_info(),
    )
    .commit_and_undelegate(&[control.to_account_info()])
    .build_and_invoke()?;
    Ok(())
}
