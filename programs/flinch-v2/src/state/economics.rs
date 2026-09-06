use anchor_lang::prelude::*;
use flinch_domain::{Ledger, LedgerSnapshot, TerminalReason};

use crate::error::{DomainResult, FlinchError};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct EconomicState {
    pub started_at: i64,
    pub revision: u64,
    pub next_cohort: u32,
    pub holdings: [u64; 4],
    pub usdc_claims: [u64; 4],
    pub initial_wsol: u64,
    pub swapped_wsol: u64,
    pub claimed_wsol: u64,
    pub received_usdc: u64,
    pub claimed_usdc: u64,
    pub terminal_tag: u8,
    pub terminal_seat: u8,
}

impl EconomicState {
    pub fn from_domain(ledger: &Ledger) -> Self {
        let s = ledger.snapshot();
        let (terminal_tag, terminal_seat) = match s.terminal {
            None => (0, 0),
            Some(TerminalReason::OneHolder { seat }) => (1, seat),
            Some(TerminalReason::AllSold) => (2, 0),
            Some(TerminalReason::Standoff) => (3, 0),
            Some(TerminalReason::Recovery) => (4, 0),
        };
        Self {
            started_at: s.started_at,
            revision: s.revision,
            next_cohort: s.next_cohort,
            holdings: s.holdings,
            usdc_claims: s.usdc_claims,
            initial_wsol: s.initial_wsol,
            swapped_wsol: s.swapped_wsol,
            claimed_wsol: s.claimed_wsol,
            received_usdc: s.received_usdc,
            claimed_usdc: s.claimed_usdc,
            terminal_tag,
            terminal_seat,
        }
    }

    pub fn restore(&self, round: Pubkey, stake: u64) -> Result<Ledger> {
        require!(
            self.initial_wsol == stake.checked_mul(4).ok_or(FlinchError::InvalidState)?,
            FlinchError::InvalidState
        );
        require!(
            self.terminal_tag == 1 || self.terminal_seat == 0,
            FlinchError::InvalidState
        );
        let terminal = match self.terminal_tag {
            0 => None,
            1 => Some(TerminalReason::OneHolder {
                seat: self.terminal_seat,
            }),
            2 => Some(TerminalReason::AllSold),
            3 => Some(TerminalReason::Standoff),
            4 => Some(TerminalReason::Recovery),
            _ => return err!(FlinchError::InvalidState),
        };
        Ledger::restore(LedgerSnapshot {
            round: round.to_bytes(),
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
            terminal,
        })
        .onchain()
    }
}
