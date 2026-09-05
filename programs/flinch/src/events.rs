use anchor_lang::prelude::*;

#[event]
pub struct RoundCreated {
    pub round: Pubkey,
    pub host: Pubkey,
    pub stake: u64,
    pub funding_deadline: i64,
    pub validator: Pubkey,
}

#[event]
pub struct PlayerJoined {
    pub round: Pubkey,
    pub player: Pubkey,
    pub seat: u8,
    pub stake: u64,
}

#[event]
pub struct RoundStarted {
    pub round: Pubkey,
    pub started_at: i64,
    pub ends_at: i64,
}

#[event]
pub struct SellQueued {
    pub round: Pubkey,
    pub player: Pubkey,
    pub cohort: u32,
}

#[event]
pub struct CohortResolved {
    pub round: Pubkey,
    pub cohort: u32,
    pub seller_bitmap: u8,
    pub used_vrf: bool,
    pub timed_out: bool,
}

#[event]
pub struct TieRequested {
    pub round: Pubkey,
    pub cohort: u32,
    pub request_nonce: u64,
}

#[event]
pub struct SellerPaid {
    pub round: Pubkey,
    pub player: Pubkey,
    pub rank: u8,
    pub penalty: u64,
    pub payout: u64,
}

#[event]
pub struct RoundSettled {
    pub round: Pubkey,
    pub holder: Pubkey,
    pub holder_payout: u64,
    pub total_paid: u64,
}

#[event]
pub struct RoundCancelled {
    pub round: Pubkey,
    pub authority: Pubkey,
    pub funded_count: u8,
}

#[event]
pub struct PlayerRefunded {
    pub round: Pubkey,
    pub player: Pubkey,
    pub amount: u64,
}
