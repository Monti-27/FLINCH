use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::{anchor::delegate, cpi::DelegateConfig};

use crate::{constants::*, error::FlinchError, state::*};

#[delegate]
#[derive(Accounts)]
pub struct DelegateControl<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(seeds = [LEDGER_SEED, ledger.host.as_ref(), &ledger.nonce.to_le_bytes()], bump = ledger.bump)]
    pub ledger: Account<'info, RoomLedger>,
    #[account(mut, del, seeds = [CONTROL_SEED, ledger.key().as_ref()], bump)]
    pub control: UncheckedAccount<'info>,
}

pub fn handle_delegate(ctx: Context<DelegateControl>) -> Result<()> {
    let room = &ctx.accounts.ledger;
    let domain = room.domain(room.key())?;
    require!(
        domain.terminal().is_none() && Clock::get()?.unix_timestamp < domain.ends_at(),
        FlinchError::WrongPhase
    );
    require_keys_eq!(
        *ctx.accounts.control.owner,
        crate::ID,
        FlinchError::InvalidControl
    );
    {
        let mut bytes = ctx.accounts.control.try_borrow_mut_data()?;
        let mut control = RoomControl::try_deserialize(&mut bytes.as_ref())?;
        require!(
            control.version == VERSION && control.bump == ctx.bumps.control,
            FlinchError::InvalidControl
        );
        require_keys_eq!(control.ledger, room.key(), FlinchError::InvalidControl);
        require!(
            matches!(
                control.phase,
                ControlPhase::Prepared | ControlPhase::Resolved
            ) && control.sellers == 0
                && control.minimum_outputs == [0; 4],
            FlinchError::InvalidControl
        );
        require!(
            control.revision == domain.revision() && control.holdings == domain.holdings(),
            FlinchError::InvalidControl
        );
        control.validator = room.validator;
        control.wallets = room.wallets;
        control.session_signers = room.session_signers;
        control.started_at = domain.snapshot().started_at;
        control.next_cohort = domain.next_cohort();
        control.phase = ControlPhase::Live;
        control.try_serialize(&mut bytes.as_mut())?;
    }
    ctx.accounts.delegate_control(
        &ctx.accounts.payer,
        &[CONTROL_SEED, room.key().as_ref()],
        DelegateConfig {
            validator: Some(room.validator),
            ..Default::default()
        },
    )?;
    Ok(())
}
