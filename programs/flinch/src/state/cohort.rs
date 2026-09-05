use anchor_lang::prelude::*;

#[derive(
    AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, Default, InitSpace, PartialEq, Eq,
)]
pub enum CohortStatus {
    #[default]
    Empty,
    Open,
    AwaitingVrf,
}

#[derive(
    AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, Default, InitSpace, PartialEq, Eq,
)]
pub struct Cohort {
    pub index: u32,
    pub closes_at: i64,
    pub seller_bitmap: u8,
    pub seller_count: u8,
    pub terminal: bool,
    pub status: CohortStatus,
}
