use anchor_lang::prelude::*;

use crate::{constants::*, error::DomainResult, state::RoomLedger};

#[derive(Accounts)]
pub struct RecoverRound<'info> {
    #[account(mut, seeds = [LEDGER_SEED, ledger.host.as_ref(), &ledger.nonce.to_le_bytes()], bump = ledger.bump)]
    pub ledger: Account<'info, RoomLedger>,
}

pub fn handle_recover(ctx: Context<RecoverRound>) -> Result<()> {
    let ledger = &mut ctx.accounts.ledger;
    let mut domain = ledger.domain(ledger.key())?;
    domain.recover(Clock::get()?.unix_timestamp).onchain()?;
    ledger.store(&domain);
    Ok(())
}
