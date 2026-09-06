use anchor_lang::prelude::*;

use super::EconomicState;
use crate::{constants::*, error::FlinchError};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace, PartialEq, Eq)]
pub enum RoomPhase {
    Funding,
    Cancelled,
    Started,
}

#[account]
#[derive(InitSpace)]
pub struct RoomLedger {
    pub version: u8,
    pub bump: u8,
    pub host: Pubkey,
    pub nonce: u64,
    pub validator: Pubkey,
    pub pool: Pubkey,
    pub stake: u64,
    pub funding_deadline: i64,
    pub phase: RoomPhase,
    pub wallets: [Pubkey; 4],
    pub session_signers: [Pubkey; 4],
    pub refunded: [bool; 4],
    pub economics: Option<EconomicState>,
}

impl RoomLedger {
    pub fn validate(&self) -> Result<()> {
        require!(self.version == VERSION, FlinchError::InvalidState);
        require!(
            (MIN_STAKE..=MAX_STAKE).contains(&self.stake),
            FlinchError::InvalidState
        );
        require!(
            self.host != Pubkey::default() && self.validator != Pubkey::default(),
            FlinchError::InvalidState
        );
        require!(
            self.pool != Pubkey::default() && self.funding_deadline >= FUNDING_SECONDS,
            FlinchError::InvalidState
        );
        let mut empty_seen = false;
        for (seat, wallet) in self.wallets.iter().enumerate() {
            if *wallet == Pubkey::default() {
                empty_seen = true;
                require!(!self.refunded[seat], FlinchError::InvalidState);
            } else {
                require!(
                    !empty_seen && !self.wallets[..seat].contains(wallet),
                    FlinchError::InvalidState
                );
            }
        }
        require!(
            self.phase == RoomPhase::Cancelled || !self.refunded.iter().any(|value| *value),
            FlinchError::InvalidState
        );
        require!(
            (self.phase == RoomPhase::Started) == self.economics.is_some(),
            FlinchError::InvalidState
        );
        if self.phase == RoomPhase::Started {
            require!(!empty_seen, FlinchError::InvalidState);
        }
        Ok(())
    }

    pub fn seat(&self, wallet: Pubkey) -> Result<usize> {
        require!(wallet != Pubkey::default(), FlinchError::Unauthorized);
        self.wallets
            .iter()
            .position(|key| *key == wallet)
            .ok_or_else(|| error!(FlinchError::Unauthorized))
    }

    pub fn domain(&self, key: Pubkey) -> Result<flinch_domain::Ledger> {
        self.validate()?;
        self.economics
            .as_ref()
            .ok_or(FlinchError::WrongPhase)?
            .restore(key, self.stake)
    }

    pub fn store(&mut self, ledger: &flinch_domain::Ledger) {
        self.economics = Some(EconomicState::from_domain(ledger));
    }

    pub fn funding_liability(&self) -> u64 {
        self.wallets
            .iter()
            .zip(self.refunded)
            .filter(|(wallet, refunded)| **wallet != Pubkey::default() && !refunded)
            .count() as u64
            * self.stake
    }
}
