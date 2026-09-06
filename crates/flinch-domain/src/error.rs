use core::fmt;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DomainError {
    InvalidAmount,
    InvalidSellers,
    InvalidSeat,
    InvalidTime,
    InvalidMinimum,
    NotHolding,
    RoundTerminal,
    RoundStillLive,
    WrongRound,
    StaleBatch,
    SnapshotMismatch,
    CohortOpen,
    BatchExpired,
    BatchNotExpired,
    RecoveryTooEarly,
    InputMismatch,
    MinimumNotMet,
    NothingToClaim,
    Overflow,
    ConservationViolation,
    InvalidSnapshot,
}

pub type Result<T> = core::result::Result<T, DomainError>;

impl fmt::Display for DomainError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        let message = match self {
            Self::InvalidAmount => "amount must be positive",
            Self::InvalidSellers => "seller bitmap must contain only valid seats",
            Self::InvalidSeat => "seat is outside the room",
            Self::InvalidTime => "time is outside the valid round range",
            Self::InvalidMinimum => "only sellers must have positive minimum outputs",
            Self::NotHolding => "seller has no remaining position",
            Self::RoundTerminal => "round is terminal",
            Self::RoundStillLive => "unsold positions cannot be claimed during play",
            Self::WrongRound => "batch belongs to another round",
            Self::StaleBatch => "batch revision is no longer current",
            Self::SnapshotMismatch => "batch snapshot does not match the ledger",
            Self::CohortOpen => "cohort has not closed",
            Self::BatchExpired => "batch execution window has expired",
            Self::BatchNotExpired => "batch execution window remains open",
            Self::RecoveryTooEarly => "recovery cutoff has not elapsed",
            Self::InputMismatch => "observed swap input differs from the authorized amount",
            Self::MinimumNotMet => "allocated output is below a seller minimum",
            Self::NothingToClaim => "no remaining claim",
            Self::Overflow => "integer arithmetic exceeded its range",
            Self::ConservationViolation => "asset accounting does not reconcile",
            Self::InvalidSnapshot => "stored ledger fields are inconsistent",
        };
        formatter.write_str(message)
    }
}

impl core::error::Error for DomainError {}
