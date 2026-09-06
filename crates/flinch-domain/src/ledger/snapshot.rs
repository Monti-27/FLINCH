use crate::{DomainError, Result, COHORT_SECONDS, ROUND_SECONDS, SEATS};

use super::{Ledger, TerminalReason};

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct LedgerSnapshot {
    pub round: [u8; 32],
    pub started_at: i64,
    pub revision: u64,
    pub next_cohort: u32,
    pub holdings: [u64; SEATS],
    pub usdc_claims: [u64; SEATS],
    pub initial_wsol: u64,
    pub swapped_wsol: u64,
    pub claimed_wsol: u64,
    pub received_usdc: u64,
    pub claimed_usdc: u64,
    pub terminal: Option<TerminalReason>,
}

impl Ledger {
    pub fn snapshot(&self) -> LedgerSnapshot {
        LedgerSnapshot {
            round: self.round,
            started_at: self.started_at,
            revision: self.revision,
            next_cohort: self.next_cohort,
            holdings: self.holdings,
            usdc_claims: self.usdc_claims,
            initial_wsol: self.initial_wsol,
            swapped_wsol: self.swapped_wsol,
            claimed_wsol: self.claimed_wsol,
            received_usdc: self.received_usdc,
            claimed_usdc: self.claimed_usdc,
            terminal: self.terminal,
        }
    }

    pub fn restore(snapshot: LedgerSnapshot) -> Result<Self> {
        if snapshot.initial_wsol == 0 || !snapshot.initial_wsol.is_multiple_of(SEATS as u64) {
            return Err(DomainError::InvalidSnapshot);
        }
        let stake = snapshot.initial_wsol / SEATS as u64;
        let mut ledger = Self::new(snapshot.round, stake, snapshot.started_at)?;
        ledger.revision = snapshot.revision;
        ledger.next_cohort = snapshot.next_cohort;
        ledger.holdings = snapshot.holdings;
        ledger.usdc_claims = snapshot.usdc_claims;
        ledger.swapped_wsol = snapshot.swapped_wsol;
        ledger.claimed_wsol = snapshot.claimed_wsol;
        ledger.received_usdc = snapshot.received_usdc;
        ledger.claimed_usdc = snapshot.claimed_usdc;
        ledger.terminal = snapshot.terminal;
        ledger.assert_conserved()?;
        ledger.validate_snapshot(stake)?;
        Ok(ledger)
    }

    fn validate_snapshot(&self, stake: u64) -> Result<()> {
        let cohorts = (ROUND_SECONDS / COHORT_SECONDS) as u64;
        let holders = self.holdings.iter().filter(|amount| **amount > 0).count();
        if u64::from(self.next_cohort) >= cohorts
            || self.revision > u64::from(self.next_cohort) + 1
            || (self.swapped_wsol == 0) != (self.received_usdc == 0)
            || self
                .holdings
                .iter()
                .zip(self.usdc_claims)
                .any(|(wsol, usdc)| *wsol > 0 && (*wsol < stake || usdc > 0))
        {
            return Err(DomainError::InvalidSnapshot);
        }
        if self.revision == 0
            && (self.next_cohort != 0
                || self.swapped_wsol != 0
                || self
                    .holdings
                    .iter()
                    .any(|amount| ![0, stake].contains(amount)))
        {
            return Err(DomainError::InvalidSnapshot);
        }
        let valid_terminal = match self.terminal {
            None => holders >= 2 && self.claimed_wsol == 0,
            Some(TerminalReason::AllSold) => {
                holders == 0 && self.claimed_wsol == 0 && self.revision > 0
            }
            Some(TerminalReason::OneHolder { seat }) => {
                usize::from(seat) < SEATS
                    && self.revision > 0
                    && self
                        .holdings
                        .iter()
                        .enumerate()
                        .all(|(index, amount)| index == usize::from(seat) || *amount == 0)
                    && self.initial_wsol > self.swapped_wsol
            }
            Some(TerminalReason::Standoff) => {
                self.revision > 0 && self.initial_wsol > self.swapped_wsol
            }
            Some(TerminalReason::Recovery) => self.initial_wsol > self.swapped_wsol,
        };
        if !valid_terminal {
            return Err(DomainError::InvalidSnapshot);
        }
        Ok(())
    }
}
