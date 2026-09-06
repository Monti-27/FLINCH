use anchor_lang::prelude::*;

#[error_code]
pub enum FlinchError {
    InvalidConfiguration,
    WrongPhase,
    FundingExpired,
    Unauthorized,
    DuplicateWallet,
    RoomFull,
    RoomNotFull,
    InvalidState,
    NothingToClaim,
    InvalidMint,
    InvalidPool,
    InvalidVault,
    TransferMismatch,
    InsufficientCustody,
    DomainRejected,
    InvalidControl,
}

pub trait DomainResult<T> {
    fn onchain(self) -> Result<T>;
}

impl<T> DomainResult<T> for flinch_domain::Result<T> {
    fn onchain(self) -> Result<T> {
        self.map_err(|failure| {
            msg!("{}", failure);
            error!(FlinchError::DomainRejected)
        })
    }
}
