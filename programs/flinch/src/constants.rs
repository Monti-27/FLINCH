use anchor_lang::prelude::*;

pub const ROUND_SEED: &[u8] = b"round";
pub const MAX_PLAYERS: usize = 4;
pub const MAX_SELLERS: usize = MAX_PLAYERS - 1;
pub const ROUND_DURATION_SECONDS: i64 = 90;
pub const COHORT_DURATION_SECONDS: i64 = 2;
pub const VRF_TIMEOUT_SECONDS: i64 = 10;
pub const BASIS_POINTS_DENOMINATOR: u64 = 10_000;
pub const PENALTY_BPS: [u16; MAX_SELLERS] = [2_000, 1_200, 600];
pub const NO_SELL_RANK: u8 = 0;
pub const PROGRAM_VERSION: u8 = 1;
pub const WSOL_MINT: Pubkey = pubkey!("So11111111111111111111111111111111111111112");
