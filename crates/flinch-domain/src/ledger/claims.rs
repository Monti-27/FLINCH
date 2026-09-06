use crate::{DomainError, Result, SEATS};

use super::Ledger;

impl Ledger {
    pub fn claim_usdc(&mut self, seat: usize) -> Result<u64> {
        if seat >= SEATS {
            return Err(DomainError::InvalidSeat);
        }
        let amount = self.usdc_claims[seat];
        if amount == 0 {
            return Err(DomainError::NothingToClaim);
        }
        let mut next = self.clone();
        next.claimed_usdc = next
            .claimed_usdc
            .checked_add(amount)
            .ok_or(DomainError::Overflow)?;
        next.usdc_claims[seat] = 0;
        next.assert_conserved()?;
        *self = next;
        Ok(amount)
    }

    pub fn claim_wsol(&mut self, seat: usize) -> Result<u64> {
        if seat >= SEATS {
            return Err(DomainError::InvalidSeat);
        }
        if self.terminal.is_none() {
            return Err(DomainError::RoundStillLive);
        }
        let amount = self.holdings[seat];
        if amount == 0 {
            return Err(DomainError::NothingToClaim);
        }
        let mut next = self.clone();
        next.claimed_wsol = next
            .claimed_wsol
            .checked_add(amount)
            .ok_or(DomainError::Overflow)?;
        next.holdings[seat] = 0;
        next.assert_conserved()?;
        *self = next;
        Ok(amount)
    }
}
