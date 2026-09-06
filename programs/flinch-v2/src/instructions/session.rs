use anchor_lang::prelude::*;

use crate::{constants::*, error::FlinchError, state::*};

#[derive(Accounts)]
pub struct SetSessionSigner<'info> {
    pub player: Signer<'info>,
    #[account(mut, seeds = [LEDGER_SEED, ledger.host.as_ref(), &ledger.nonce.to_le_bytes()], bump = ledger.bump)]
    pub ledger: Account<'info, RoomLedger>,
}

pub fn handle_session(ctx: Context<SetSessionSigner>, signer: Pubkey) -> Result<()> {
    let room = &mut ctx.accounts.ledger;
    room.validate()?;
    require!(room.phase == RoomPhase::Funding, FlinchError::WrongPhase);
    require!(
        Clock::get()?.unix_timestamp < room.funding_deadline,
        FlinchError::FundingExpired
    );
    let seat = room.seat(ctx.accounts.player.key())?;
    require!(
        room.session_signers[seat] != signer,
        FlinchError::InvalidConfiguration
    );
    room.session_signers[seat] = signer;
    Ok(())
}
