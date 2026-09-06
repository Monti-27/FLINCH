use crate::{DomainError, ExitBatch, Result, COHORT_SECONDS, SEATS};

use super::{Ledger, TerminalReason};

impl Ledger {
    pub fn apply_fill(
        &mut self,
        batch: &ExitBatch,
        observed_input: u64,
        observed_output: u64,
        now: i64,
    ) -> Result<[u64; SEATS]> {
        self.validate_batch(batch)?;
        if now < batch.window().closes_at() {
            return Err(DomainError::CohortOpen);
        }
        if now >= batch.window().expires_at() || now >= self.recovery_at {
            return Err(DomainError::BatchExpired);
        }
        if observed_input != batch.economics().total_input() {
            return Err(DomainError::InputMismatch);
        }
        let outputs = batch.allocate_output(observed_output)?;
        let mut next = self.clone();
        next.revision = next.revision.checked_add(1).ok_or(DomainError::Overflow)?;
        next.swapped_wsol = next
            .swapped_wsol
            .checked_add(observed_input)
            .ok_or(DomainError::Overflow)?;
        next.received_usdc = next
            .received_usdc
            .checked_add(observed_output)
            .ok_or(DomainError::Overflow)?;
        next.holdings = batch.economics().remaining();
        for (claim, output) in next.usdc_claims.iter_mut().zip(outputs) {
            *claim = claim.checked_add(output).ok_or(DomainError::Overflow)?;
        }
        next.update_terminal(now);
        next.advance_cohort(batch, now)?;
        next.assert_conserved()?;
        *self = next;
        Ok(outputs)
    }

    pub fn expire_batch(&mut self, batch: &ExitBatch, now: i64) -> Result<()> {
        self.validate_batch(batch)?;
        if now < batch.window().expires_at() {
            return Err(DomainError::BatchNotExpired);
        }
        let mut next = self.clone();
        next.revision = next.revision.checked_add(1).ok_or(DomainError::Overflow)?;
        next.update_terminal(now);
        next.advance_cohort(batch, now)?;
        next.assert_conserved()?;
        *self = next;
        Ok(())
    }

    pub fn recover(&mut self, now: i64) -> Result<()> {
        self.ensure_live()?;
        if now < self.recovery_at {
            return Err(DomainError::RecoveryTooEarly);
        }
        self.assert_conserved()?;
        self.terminal = Some(TerminalReason::Recovery);
        Ok(())
    }

    fn update_terminal(&mut self, now: i64) {
        let mut last = None;
        let mut count = 0;
        for (seat, holding) in self.holdings.iter().enumerate() {
            if *holding > 0 {
                last = Some(seat as u8);
                count += 1;
            }
        }
        self.terminal = match (count, last) {
            (0, _) => Some(TerminalReason::AllSold),
            (1, Some(seat)) => Some(TerminalReason::OneHolder { seat }),
            _ if now >= self.ends_at => Some(TerminalReason::Standoff),
            _ => None,
        };
    }

    fn advance_cohort(&mut self, batch: &ExitBatch, now: i64) -> Result<()> {
        if self.terminal.is_some() {
            return Ok(());
        }
        let elapsed = now
            .checked_sub(self.started_at)
            .ok_or(DomainError::Overflow)?;
        let current = u32::try_from(elapsed / COHORT_SECONDS).map_err(|_| DomainError::Overflow)?;
        self.next_cohort = current.max(
            batch
                .window()
                .index()
                .checked_add(1)
                .ok_or(DomainError::Overflow)?,
        );
        Ok(())
    }
}
