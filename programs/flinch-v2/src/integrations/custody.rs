use anchor_lang::prelude::*;
use anchor_spl::token::{self, TransferChecked};

use crate::error::FlinchError;

pub fn transfer<'info>(
    from: AccountInfo<'info>,
    to: AccountInfo<'info>,
    mint: AccountInfo<'info>,
    authority: AccountInfo<'info>,
    amount: u64,
    decimals: u8,
    seeds: &[&[&[u8]]],
) -> Result<()> {
    require_keys_neq!(from.key(), to.key(), FlinchError::InvalidVault);
    token::transfer_checked(
        CpiContext::new_with_signer(
            token::ID,
            TransferChecked {
                from,
                mint,
                to,
                authority,
            },
            seeds,
        ),
        amount,
        decimals,
    )
}

pub fn verify_delta(before: u64, after: u64, amount: u64) -> Result<()> {
    require!(
        before.checked_sub(after) == Some(amount),
        FlinchError::TransferMismatch
    );
    Ok(())
}
