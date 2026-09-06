use anchor_lang::prelude::*;

pub const VERSION: u8 = 2;
pub const LEDGER_SEED: &[u8] = b"ledger-v2";
pub const CONTROL_SEED: &[u8] = b"control-v2";
pub const RECEIPT_SEED: &[u8] = b"receipt-v2";
pub const USDC_MINT: Pubkey = pubkey!("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
pub const WSOL_MINT: Pubkey = anchor_spl::token::spl_token::native_mint::ID;
pub const MIN_STAKE: u64 = 1_000_000;
pub const MAX_STAKE: u64 = 10_000_000;
pub const FUNDING_SECONDS: i64 = 300;
