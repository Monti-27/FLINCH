use anchor_lang::prelude::*;
use flinch_domain::CohortWindow;
use session_keys::SessionTokenV2;

use crate::{
    constants::*,
    error::{DomainResult, FlinchError},
    integrations::session,
    state::*,
};

#[derive(Accounts)]
pub struct QueueSell<'info> {
    pub signer: Signer<'info>,
    #[account(mut, seeds = [CONTROL_SEED, control.ledger.as_ref()], bump = control.bump)]
    pub control: Account<'info, RoomControl>,
    pub session_token: Option<Account<'info, SessionTokenV2>>,
}

pub fn handle_queue(
    ctx: Context<QueueSell>,
    seat: u8,
    nonce: u64,
    minimum_output: u64,
) -> Result<()> {
    let control = &mut ctx.accounts.control;
    require!(
        control.version == VERSION && control.phase == ControlPhase::Live,
        FlinchError::InvalidControl
    );
    let seat = usize::from(seat);
    session::authorize(
        control,
        seat,
        &ctx.accounts.signer,
        &ctx.accounts.session_token,
    )?;
    require!(
        control.holdings[seat] > 0
            && control.holdings.iter().filter(|value| **value > 0).count() > 1,
        FlinchError::WrongPhase
    );
    let cohort = CohortWindow::at(control.started_at, Clock::get()?.unix_timestamp).onchain()?;
    require!(
        cohort.index() >= control.next_cohort
            && (control.sellers == 0 || control.cohort_index == cohort.index()),
        FlinchError::InvalidControl
    );
    require!(
        control.sellers & (1 << seat) == 0
            && control.attempts[seat] < 3
            && nonce > control.nonces[seat]
            && minimum_output > 0,
        FlinchError::InvalidControl
    );
    control
        .minimum_outputs
        .iter()
        .try_fold(minimum_output, |total, amount| total.checked_add(*amount))
        .ok_or(FlinchError::InvalidControl)?;
    control.cohort_index = cohort.index();
    control.sellers |= 1 << seat;
    control.minimum_outputs[seat] = minimum_output;
    control.nonces[seat] = nonce;
    control.attempts[seat] += 1;
    Ok(())
}
