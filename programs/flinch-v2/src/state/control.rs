use anchor_lang::prelude::*;
use flinch_domain::{ExitBatch, Ledger, SellerSet};

use crate::{
    constants::VERSION,
    error::{DomainResult, FlinchError},
    state::RoomLedger,
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace, PartialEq, Eq)]
pub enum ControlPhase {
    Prepared,
    Live,
    Frozen,
    Resolved,
}

#[account]
#[derive(InitSpace)]
pub struct RoomControl {
    pub version: u8,
    pub bump: u8,
    pub ledger: Pubkey,
    pub validator: Pubkey,
    pub wallets: [Pubkey; 4],
    pub session_signers: [Pubkey; 4],
    pub started_at: i64,
    pub revision: u64,
    pub next_cohort: u32,
    pub holdings: [u64; 4],
    pub phase: ControlPhase,
    pub attempts: [u8; 4],
    pub nonces: [u64; 4],
    pub sellers: u8,
    pub cohort_index: u32,
    pub minimum_outputs: [u64; 4],
}

impl RoomControl {
    pub fn batch(&self, room: &RoomLedger, key: Pubkey, domain: &Ledger) -> Result<ExitBatch> {
        require!(
            self.version == VERSION && self.phase == ControlPhase::Frozen,
            FlinchError::InvalidControl
        );
        require_keys_eq!(self.ledger, key, FlinchError::InvalidControl);
        require_keys_eq!(self.validator, room.validator, FlinchError::InvalidControl);
        require!(
            self.wallets == room.wallets
                && self.session_signers == room.session_signers
                && self.revision == domain.revision()
                && self.holdings == domain.holdings()
                && self.next_cohort == domain.next_cohort()
                && self.started_at == domain.snapshot().started_at,
            FlinchError::InvalidControl
        );
        let sellers = SellerSet::new(self.sellers).onchain()?;
        for seat in 0..4 {
            require!(self.attempts[seat] <= 3, FlinchError::InvalidControl);
            if sellers.contains(seat) {
                require!(
                    self.attempts[seat] > 0 && self.nonces[seat] > 0,
                    FlinchError::InvalidControl
                );
            }
        }
        domain
            .prepare_batch(sellers, self.minimum_outputs, self.cohort_index)
            .onchain()
    }

    pub fn resolve(&mut self, domain: &Ledger) {
        self.revision = domain.revision();
        self.holdings = domain.holdings();
        self.next_cohort = domain.next_cohort();
        self.phase = ControlPhase::Resolved;
        self.sellers = 0;
        self.minimum_outputs = [0; 4];
        self.cohort_index = domain.next_cohort();
    }
}
