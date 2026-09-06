use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct BatchReceipt {
    pub version: u8,
    pub ledger: Pubkey,
    pub revision: u64,
    pub sellers: u8,
    pub cohort_index: u32,
    pub expired: bool,
    pub executed_at: i64,
    pub input: u64,
    pub output: u64,
    pub allocations: [u64; 4],
}
