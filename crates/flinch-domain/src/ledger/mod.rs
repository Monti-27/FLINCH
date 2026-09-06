mod claims;
mod settlement;
mod snapshot;

pub use snapshot::LedgerSnapshot;

use crate::allocation::sum;
use crate::{
    CohortWindow, DomainError, ExitBatch, Result, SellerSet, RECOVERY_SECONDS, ROUND_SECONDS, SEATS,
};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TerminalReason {
    OneHolder { seat: u8 },
    AllSold,
    Standoff,
    Recovery,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Accounting {
    pub initial_wsol: u64,
    pub swapped_wsol: u64,
    pub remaining_wsol: u64,
    pub claimed_wsol: u64,
    pub received_usdc: u64,
    pub claimable_usdc: u64,
    pub claimed_usdc: u64,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Ledger {
    round: [u8; 32],
    started_at: i64,
    ends_at: i64,
    recovery_at: i64,
    revision: u64,
    next_cohort: u32,
    holdings: [u64; SEATS],
    usdc_claims: [u64; SEATS],
    initial_wsol: u64,
    swapped_wsol: u64,
    claimed_wsol: u64,
    received_usdc: u64,
    claimed_usdc: u64,
    terminal: Option<TerminalReason>,
}

impl Ledger {
    pub fn new(round: [u8; 32], stake: u64, started_at: i64) -> Result<Self> {
        if stake == 0 {
            return Err(DomainError::InvalidAmount);
        }
        if started_at < 0 {
            return Err(DomainError::InvalidTime);
        }
        let initial_wsol = stake
            .checked_mul(SEATS as u64)
            .ok_or(DomainError::Overflow)?;
        let ends_at = started_at
            .checked_add(ROUND_SECONDS)
            .ok_or(DomainError::Overflow)?;
        let recovery_at = ends_at
            .checked_add(RECOVERY_SECONDS)
            .ok_or(DomainError::Overflow)?;
        Ok(Self {
            round,
            started_at,
            ends_at,
            recovery_at,
            revision: 0,
            next_cohort: 0,
            holdings: [stake; SEATS],
            usdc_claims: [0; SEATS],
            initial_wsol,
            swapped_wsol: 0,
            claimed_wsol: 0,
            received_usdc: 0,
            claimed_usdc: 0,
            terminal: None,
        })
    }

    pub fn prepare_batch(
        &self,
        sellers: SellerSet,
        minimum_outputs: [u64; SEATS],
        cohort_index: u32,
    ) -> Result<ExitBatch> {
        self.ensure_live()?;
        if cohort_index < self.next_cohort {
            return Err(DomainError::InvalidTime);
        }
        ExitBatch::new(
            self.round,
            self.revision,
            self.holdings,
            sellers,
            minimum_outputs,
            CohortWindow::new(self.started_at, cohort_index)?,
        )
    }

    pub fn revision(&self) -> u64 {
        self.revision
    }

    pub fn next_cohort(&self) -> u32 {
        self.next_cohort
    }

    pub fn holdings(&self) -> [u64; SEATS] {
        self.holdings
    }

    pub fn usdc_claims(&self) -> [u64; SEATS] {
        self.usdc_claims
    }

    pub fn ends_at(&self) -> i64 {
        self.ends_at
    }

    pub fn recovery_at(&self) -> i64 {
        self.recovery_at
    }

    pub fn terminal(&self) -> Option<TerminalReason> {
        self.terminal
    }

    pub fn accounting(&self) -> Result<Accounting> {
        Ok(Accounting {
            initial_wsol: self.initial_wsol,
            swapped_wsol: self.swapped_wsol,
            remaining_wsol: sum(&self.holdings)?,
            claimed_wsol: self.claimed_wsol,
            received_usdc: self.received_usdc,
            claimable_usdc: sum(&self.usdc_claims)?,
            claimed_usdc: self.claimed_usdc,
        })
    }

    pub fn assert_conserved(&self) -> Result<()> {
        let state = self.accounting()?;
        let wsol = state
            .swapped_wsol
            .checked_add(state.remaining_wsol)
            .and_then(|amount| amount.checked_add(state.claimed_wsol));
        let usdc = state.claimable_usdc.checked_add(state.claimed_usdc);
        if wsol != Some(state.initial_wsol) || usdc != Some(state.received_usdc) {
            return Err(DomainError::ConservationViolation);
        }
        Ok(())
    }

    fn ensure_live(&self) -> Result<()> {
        if self.terminal.is_some() {
            return Err(DomainError::RoundTerminal);
        }
        Ok(())
    }

    fn validate_batch(&self, batch: &ExitBatch) -> Result<()> {
        self.ensure_live()?;
        if batch.round != self.round {
            return Err(DomainError::WrongRound);
        }
        if batch.revision != self.revision {
            return Err(DomainError::StaleBatch);
        }
        if batch.holdings != self.holdings
            || batch.window() != CohortWindow::new(self.started_at, batch.window().index())?
        {
            return Err(DomainError::SnapshotMismatch);
        }
        Ok(())
    }
}
