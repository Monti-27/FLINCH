use anchor_lang::prelude::*;

use crate::constants::NO_SELL_RANK;

#[derive(
    AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, Default, InitSpace, PartialEq, Eq,
)]
pub enum PlayerStatus {
    #[default]
    Empty,
    Funded,
    Holding,
    PendingSell,
    Sold,
    FinalHolder,
    Refunded,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, InitSpace, PartialEq, Eq)]
pub struct PlayerSlot {
    pub wallet: Pubkey,
    pub token_account: Pubkey,
    pub status: PlayerStatus,
    pub sell_rank: u8,
    pub sell_cohort: u32,
    pub sell_timestamp: i64,
    pub penalty_paid: u64,
    pub payout: u64,
    pub payout_claimed: bool,
    pub last_action_nonce: u64,
}

impl Default for PlayerSlot {
    fn default() -> Self {
        Self {
            wallet: Pubkey::default(),
            token_account: Pubkey::default(),
            status: PlayerStatus::Empty,
            sell_rank: NO_SELL_RANK,
            sell_cohort: 0,
            sell_timestamp: 0,
            penalty_paid: 0,
            payout: 0,
            payout_claimed: false,
            last_action_nonce: 0,
        }
    }
}
