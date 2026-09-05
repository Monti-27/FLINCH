use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::delegate;
use ephemeral_rollups_sdk::cpi::DelegateConfig;

use crate::constants::ROUND_SEED;
use crate::error::FlinchError;
use crate::state::Round;

#[delegate]
#[derive(Accounts)]
#[instruction(host_nonce: u64)]
pub struct DelegateRound<'info> {
    #[account(mut)]
    pub host: Signer<'info>,
    #[account(
        mut,
        del,
        seeds = [ROUND_SEED, host.key().as_ref(), host_nonce.to_le_bytes().as_ref()],
        bump
    )]
    pub round: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<DelegateRound>, host_nonce: u64, validator: Pubkey) -> Result<()> {
    let round_info = ctx.accounts.round.to_account_info();
    {
        let data = round_info.try_borrow_data()?;
        let round = Round::try_deserialize(&mut data.as_ref())?;
        round.assert_address(round_info.key())?;
        require_keys_eq!(
            round.host,
            ctx.accounts.host.key(),
            FlinchError::UnauthorizedHost
        );
        require_keys_eq!(round.validator, validator, FlinchError::InvalidValidator);
    }
    ctx.accounts.delegate_round(
        &ctx.accounts.host,
        &[
            ROUND_SEED,
            ctx.accounts.host.key().as_ref(),
            &host_nonce.to_le_bytes(),
        ],
        DelegateConfig {
            validator: Some(validator),
            ..Default::default()
        },
    )?;
    Ok(())
}
