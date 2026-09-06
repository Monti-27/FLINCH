use crate::allocation::sum;
use crate::config::BPS_DENOMINATOR;
use crate::{allocate_proportionally, DomainError, Result, SellerSet, PENALTY_BPS, SEATS};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ExitEconomics {
    penalties: [u64; SEATS],
    net_inputs: [u64; SEATS],
    remaining: [u64; SEATS],
    total_input: u64,
}

impl ExitEconomics {
    pub fn calculate(holdings: [u64; SEATS], sellers: SellerSet) -> Result<Self> {
        let initial = sum(&holdings)?;
        let holder_count = holdings.iter().filter(|amount| **amount > 0).count();
        if holder_count <= 1 {
            return Err(DomainError::RoundTerminal);
        }
        let mut reward_weights = [0; SEATS];
        for seat in 0..SEATS {
            if sellers.contains(seat) && holdings[seat] == 0 {
                return Err(DomainError::NotHolding);
            }
            reward_weights[seat] = u64::from(holdings[seat] > 0 && !sellers.contains(seat));
        }
        let has_recipients = sum(&reward_weights)? > 0;
        let mut penalties = [0u64; SEATS];
        let mut net_inputs = [0u64; SEATS];
        let mut remaining = holdings;
        for seat in 0..SEATS {
            if !sellers.contains(seat) {
                continue;
            }
            if has_recipients {
                penalties[seat] = u64::try_from(
                    u128::from(holdings[seat]) * u128::from(PENALTY_BPS)
                        / u128::from(BPS_DENOMINATOR),
                )
                .map_err(|_| DomainError::Overflow)?;
            }
            net_inputs[seat] = holdings[seat]
                .checked_sub(penalties[seat])
                .ok_or(DomainError::Overflow)?;
            remaining[seat] = 0;
        }
        if has_recipients {
            let rewards = allocate_proportionally(sum(&penalties)?, reward_weights)?;
            for seat in 0..SEATS {
                remaining[seat] = remaining[seat]
                    .checked_add(rewards[seat])
                    .ok_or(DomainError::Overflow)?;
            }
        }
        let total_input = sum(&net_inputs)?;
        if sum(&remaining)?.checked_add(total_input) != Some(initial) {
            return Err(DomainError::ConservationViolation);
        }
        Ok(Self {
            penalties,
            net_inputs,
            remaining,
            total_input,
        })
    }

    pub fn penalties(self) -> [u64; SEATS] {
        self.penalties
    }

    pub fn net_inputs(self) -> [u64; SEATS] {
        self.net_inputs
    }

    pub fn remaining(self) -> [u64; SEATS] {
        self.remaining
    }

    pub fn total_input(self) -> u64 {
        self.total_input
    }
}
