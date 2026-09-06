use anchor_lang::prelude::*;
use session_keys::{SessionTokenV2, ValidityCheckerV2};

use crate::{error::FlinchError, state::RoomControl};

pub fn authorize<'info>(
    control: &RoomControl,
    seat: usize,
    signer: &Signer<'info>,
    token: &Option<Account<'info, SessionTokenV2>>,
) -> Result<()> {
    require!(seat < 4, FlinchError::Unauthorized);
    let wallet = control.wallets[seat];
    require!(wallet != Pubkey::default(), FlinchError::Unauthorized);
    if signer.key() == wallet {
        return Ok(());
    }
    require_keys_eq!(
        signer.key(),
        control.session_signers[seat],
        FlinchError::Unauthorized
    );
    let token = token.as_ref().ok_or(FlinchError::Unauthorized)?;
    require_keys_eq!(token.authority, wallet, FlinchError::Unauthorized);
    require_keys_eq!(
        token.session_signer,
        signer.key(),
        FlinchError::Unauthorized
    );
    require_keys_eq!(token.target_program, crate::ID, FlinchError::Unauthorized);
    require!(
        token.validate(ValidityCheckerV2 {
            session_token: token.clone(),
            session_signer: signer.clone(),
            authority: wallet,
            target_program: crate::ID,
        })?,
        FlinchError::Unauthorized
    );
    Ok(())
}
