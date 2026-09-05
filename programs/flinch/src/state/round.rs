use anchor_lang::prelude::*;

use crate::constants::{MAX_PLAYERS, PROGRAM_VERSION};
use crate::state::{Cohort, PlayerSlot, VrfState};

#[derive(
    AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, Default, InitSpace, PartialEq, Eq,
)]
pub enum RoundStatus {
    #[default]
    Funding,
    Ready,
    Live,
    TiePending,
    Finalizing,
    Settled,
    Cancelled,
}

#[derive(
    AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, Default, InitSpace, PartialEq, Eq,
)]
pub enum TerminalReason {
    #[default]
    None,
    OneHolder,
    TimerExpired,
    Cancelled,
}

#[derive(
    AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, Default, InitSpace, PartialEq, Eq,
)]
pub struct PriceSample {
    pub value: i64,
    pub exponent: i32,
    pub publish_time: i64,
    pub posted_slot: u64,
    pub valid: bool,
}

#[account]
#[derive(InitSpace)]
pub struct Round {
    pub version: u8,
    pub bump: u8,
    pub status: RoundStatus,
    pub host: Pubkey,
    pub host_nonce: u64,
    pub mint: Pubkey,
    pub validator: Pubkey,
    pub pool_token_account: Pubkey,
    pub price_account: Pubkey,
    pub price_feed_id: [u8; 32],
    pub stake: u64,
    pub created_at: i64,
    pub funding_deadline: i64,
    pub started_at: i64,
    pub ends_at: i64,
    pub next_sell_rank: u8,
    pub holding_count: u8,
    pub funded_count: u8,
    pub active_cohort: Cohort,
    pub vrf: VrfState,
    pub players: [PlayerSlot; MAX_PLAYERS],
    pub opening_price: PriceSample,
    pub closing_price: PriceSample,
    pub total_paid: u64,
    pub terminal_pool_balance: u64,
    pub terminal_reason: TerminalReason,
    pub reserved: [u8; 64],
}

impl Round {
    pub fn empty() -> Self {
        Self {
            version: PROGRAM_VERSION,
            bump: 0,
            status: RoundStatus::Funding,
            host: Pubkey::default(),
            host_nonce: 0,
            mint: Pubkey::default(),
            validator: Pubkey::default(),
            pool_token_account: Pubkey::default(),
            price_account: Pubkey::default(),
            price_feed_id: [0; 32],
            stake: 0,
            created_at: 0,
            funding_deadline: 0,
            started_at: 0,
            ends_at: 0,
            next_sell_rank: 1,
            holding_count: 0,
            funded_count: 0,
            active_cohort: Cohort::default(),
            vrf: VrfState::default(),
            players: [PlayerSlot::default(); MAX_PLAYERS],
            opening_price: PriceSample::default(),
            closing_price: PriceSample::default(),
            total_paid: 0,
            terminal_pool_balance: 0,
            terminal_reason: TerminalReason::None,
            reserved: [0; 64],
        }
    }
}
