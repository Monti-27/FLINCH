#![no_std]

mod allocation;
mod batch;
mod cohort;
mod config;
mod economics;
mod error;
mod ledger;
mod sellers;

pub use allocation::allocate_proportionally;
pub use batch::ExitBatch;
pub use cohort::CohortWindow;
pub use config::{
    COHORT_SECONDS, EXECUTION_SECONDS, PENALTY_BPS, RECOVERY_SECONDS, ROUND_SECONDS, SEATS,
};
pub use economics::ExitEconomics;
pub use error::{DomainError, Result};
pub use ledger::{Accounting, Ledger, LedgerSnapshot, TerminalReason};
pub use sellers::SellerSet;
