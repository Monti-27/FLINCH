use anchor_lang::prelude::*;

use crate::constants::{BASIS_POINTS_DENOMINATOR, MAX_PLAYERS, MAX_SELLERS, PENALTY_BPS};
use crate::error::FlinchError;

pub fn funded_pool(stake: u64) -> Result<u64> {
    stake
        .checked_mul(MAX_PLAYERS as u64)
        .ok_or_else(|| error!(FlinchError::MathOverflow))
}

pub fn penalty_for_rank(stake: u64, rank: u8) -> Result<u64> {
    let index = rank
        .checked_sub(1)
        .ok_or(FlinchError::InvalidConfiguration)? as usize;
    let bps = *PENALTY_BPS
        .get(index)
        .ok_or(FlinchError::InvalidConfiguration)? as u128;
    let value = (stake as u128)
        .checked_mul(bps)
        .and_then(|amount| amount.checked_div(BASIS_POINTS_DENOMINATOR as u128))
        .ok_or(FlinchError::MathOverflow)?;
    u64::try_from(value).map_err(|_| error!(FlinchError::MathOverflow))
}

pub fn payout_for_rank(stake: u64, rank: u8) -> Result<u64> {
    stake
        .checked_sub(penalty_for_rank(stake, rank)?)
        .ok_or_else(|| error!(FlinchError::MathOverflow))
}

pub fn timeout_penalties(stake: u64, first_rank: u8, count: u8) -> Result<[u64; MAX_SELLERS]> {
    require!(count > 0, FlinchError::InvalidConfiguration);
    require!(
        count as usize <= MAX_SELLERS,
        FlinchError::InvalidConfiguration
    );
    let mut total = 0u64;
    for offset in 0..count {
        let rank = first_rank
            .checked_add(offset)
            .ok_or(FlinchError::MathOverflow)?;
        total = total
            .checked_add(penalty_for_rank(stake, rank)?)
            .ok_or(FlinchError::MathOverflow)?;
    }
    let base = total / count as u64;
    let remainder = total % count as u64;
    let mut result = [0u64; MAX_SELLERS];
    for (index, penalty) in result.iter_mut().enumerate().take(count as usize) {
        *penalty = base + u64::from((index as u64) < remainder);
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn canonical_payout_vector_conserves_the_pool() {
        let stake = 100_000_000;
        let payouts = [
            payout_for_rank(stake, 1).unwrap(),
            payout_for_rank(stake, 2).unwrap(),
            payout_for_rank(stake, 3).unwrap(),
        ];
        let pool = funded_pool(stake).unwrap();
        let holder = pool - payouts.iter().sum::<u64>();
        assert_eq!(payouts, [80_000_000, 88_000_000, 94_000_000]);
        assert_eq!(holder, 138_000_000);
        assert_eq!(payouts.iter().sum::<u64>() + holder, pool);
    }

    #[test]
    fn timeout_distribution_preserves_all_penalties() {
        for count in 1..=3 {
            let penalties = timeout_penalties(100_000_003, 1, count).unwrap();
            let expected = (0..count)
                .map(|offset| penalty_for_rank(100_000_003, 1 + offset).unwrap())
                .sum::<u64>();
            assert_eq!(penalties[..count as usize].iter().sum::<u64>(), expected);
            let min = penalties[..count as usize].iter().min().unwrap();
            let max = penalties[..count as usize].iter().max().unwrap();
            assert!(max - min <= 1);
        }
    }

    #[test]
    fn invalid_ranks_are_rejected() {
        assert!(penalty_for_rank(1, 0).is_err());
        assert!(penalty_for_rank(1, 4).is_err());
    }
}
