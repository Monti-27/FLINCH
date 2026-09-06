use anchor_lang::prelude::*;

use crate::{constants::*, error::FlinchError, state::*};

#[derive(Accounts)]
pub struct CancelRoom<'info> {
    pub caller: Signer<'info>,
    #[account(mut, seeds = [LEDGER_SEED, ledger.host.as_ref(), &ledger.nonce.to_le_bytes()], bump = ledger.bump)]
    pub ledger: Account<'info, RoomLedger>,
}

pub fn handle_cancel(ctx: Context<CancelRoom>) -> Result<()> {
    let ledger = &mut ctx.accounts.ledger;
    ledger.validate()?;
    require!(ledger.phase == RoomPhase::Funding, FlinchError::WrongPhase);
    require!(
        ctx.accounts.caller.key() == ledger.host
            || Clock::get()?.unix_timestamp >= ledger.funding_deadline,
        FlinchError::Unauthorized
    );
    ledger.phase = RoomPhase::Cancelled;
    Ok(())
}
