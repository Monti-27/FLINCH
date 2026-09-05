use anchor_lang::prelude::*;

#[derive(
    AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, Default, InitSpace, PartialEq, Eq,
)]
pub enum VrfStatus {
    #[default]
    None,
    Requested,
    Fulfilled,
    TimedOut,
}

#[derive(
    AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, Default, InitSpace, PartialEq, Eq,
)]
pub struct VrfState {
    pub request_nonce: u64,
    pub cohort_index: u32,
    pub seller_bitmap: u8,
    pub first_rank: u8,
    pub rank_count: u8,
    pub requested_at: i64,
    pub status: VrfStatus,
}
