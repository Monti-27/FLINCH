use crate::{DomainError, Result, COHORT_SECONDS, EXECUTION_SECONDS, ROUND_SECONDS};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct CohortWindow {
    index: u32,
    opens_at: i64,
    closes_at: i64,
    expires_at: i64,
}

impl CohortWindow {
    pub fn new(started_at: i64, index: u32) -> Result<Self> {
        if started_at < 0 || i64::from(index) >= ROUND_SECONDS / COHORT_SECONDS {
            return Err(DomainError::InvalidTime);
        }
        let offset = i64::from(index)
            .checked_mul(COHORT_SECONDS)
            .ok_or(DomainError::Overflow)?;
        let opens_at = started_at
            .checked_add(offset)
            .ok_or(DomainError::Overflow)?;
        let closes_at = opens_at
            .checked_add(COHORT_SECONDS)
            .ok_or(DomainError::Overflow)?;
        let expires_at = closes_at
            .checked_add(EXECUTION_SECONDS)
            .ok_or(DomainError::Overflow)?;
        Ok(Self {
            index,
            opens_at,
            closes_at,
            expires_at,
        })
    }

    pub fn at(started_at: i64, now: i64) -> Result<Self> {
        let elapsed = now.checked_sub(started_at).ok_or(DomainError::Overflow)?;
        if !(0..ROUND_SECONDS).contains(&elapsed) {
            return Err(DomainError::InvalidTime);
        }
        let index = u32::try_from(elapsed / COHORT_SECONDS).map_err(|_| DomainError::Overflow)?;
        Self::new(started_at, index)
    }

    pub fn index(self) -> u32 {
        self.index
    }

    pub fn opens_at(self) -> i64 {
        self.opens_at
    }

    pub fn closes_at(self) -> i64 {
        self.closes_at
    }

    pub fn expires_at(self) -> i64 {
        self.expires_at
    }
}
