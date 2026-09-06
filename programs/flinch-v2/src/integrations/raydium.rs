use anchor_lang::prelude::*;
use anchor_spl::token;

use crate::{
    constants::*,
    error::FlinchError,
    raydium_cp_swap::{self, accounts::PoolState},
};

pub fn validate_pool(pool: &PoolState) -> Result<()> {
    let mints = [pool.token_0_mint, pool.token_1_mint];
    require!(
        mints == [WSOL_MINT, USDC_MINT] || mints == [USDC_MINT, WSOL_MINT],
        FlinchError::InvalidPool
    );
    let programs = [pool.token_0_program, pool.token_1_program];
    require!(programs == [token::ID; 2], FlinchError::InvalidPool);
    let decimals = [pool.mint_0_decimals, pool.mint_1_decimals];
    let expected = if mints[0] == WSOL_MINT {
        [9, 6]
    } else {
        [6, 9]
    };
    require!(decimals == expected, FlinchError::InvalidPool);
    require!(pool.status & 4 == 0, FlinchError::InvalidPool);
    Ok(())
}

pub fn swap<'info>(
    accounts: raydium_cp_swap::cpi::accounts::SwapBaseInput<'info>,
    seeds: &[&[&[u8]]],
    amount: u64,
    minimum: u64,
) -> Result<()> {
    raydium_cp_swap::cpi::swap_base_input(
        CpiContext::new_with_signer(raydium_cp_swap::ID, accounts, seeds),
        amount,
        minimum,
    )
}
