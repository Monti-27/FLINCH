use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, Transfer};

use crate::constants::ROUND_SEED;

pub struct RoundTransfer<'a, 'info> {
    pub authority: AccountInfo<'info>,
    pub from: AccountInfo<'info>,
    pub to: AccountInfo<'info>,
    pub token_program: &'a Program<'info, Token>,
    pub host: Pubkey,
    pub host_nonce: u64,
    pub bump: u8,
    pub amount: u64,
}

pub fn from_round(accounts: RoundTransfer<'_, '_>) -> Result<()> {
    let nonce = accounts.host_nonce.to_le_bytes();
    let bump_seed = [accounts.bump];
    let signer_seeds: &[&[&[u8]]] = &[&[
        ROUND_SEED,
        accounts.host.as_ref(),
        nonce.as_ref(),
        bump_seed.as_ref(),
    ]];
    token::transfer(
        CpiContext::new_with_signer(
            accounts.token_program.key(),
            Transfer {
                from: accounts.from,
                to: accounts.to,
                authority: accounts.authority,
            },
            signer_seeds,
        ),
        accounts.amount,
    )?;
    Ok(())
}
