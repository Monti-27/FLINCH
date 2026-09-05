use anchor_lang::prelude::*;

#[error_code]
pub enum FlinchError {
    #[msg("The round configuration is invalid")]
    InvalidConfiguration,
    #[msg("The round is not accepting players")]
    RoundNotFunding,
    #[msg("The funding deadline has passed")]
    FundingExpired,
    #[msg("The round is full")]
    RoundFull,
    #[msg("The player already joined")]
    PlayerAlreadyJoined,
    #[msg("The player is not in this round")]
    PlayerNotFound,
    #[msg("The round is not ready")]
    RoundNotReady,
    #[msg("Only the host can perform this action")]
    UnauthorizedHost,
    #[msg("The round is not live")]
    RoundNotLive,
    #[msg("The round has ended")]
    RoundEnded,
    #[msg("The player is not holding")]
    PlayerNotHolding,
    #[msg("The final holder cannot sell")]
    FinalHolderCannotSell,
    #[msg("The action nonce must increase")]
    InvalidActionNonce,
    #[msg("The previous sell cohort must be resolved first")]
    CohortNeedsResolution,
    #[msg("The sell cohort is still open")]
    CohortStillOpen,
    #[msg("The sell cohort is empty")]
    EmptyCohort,
    #[msg("The sell cohort is already resolved")]
    CohortAlreadyResolved,
    #[msg("A VRF request is required")]
    VrfRequired,
    #[msg("No VRF request is pending")]
    VrfNotPending,
    #[msg("The VRF request does not match")]
    InvalidVrfRequest,
    #[msg("The VRF queue is invalid")]
    InvalidVrfQueue,
    #[msg("The VRF request has not timed out")]
    VrfTimeoutNotReached,
    #[msg("The randomness stream could not produce an unbiased value")]
    RandomnessExhausted,
    #[msg("No seller payout is available")]
    PayoutNotAvailable,
    #[msg("The seller payout was already transferred")]
    PayoutAlreadyClaimed,
    #[msg("The round cannot be finalized")]
    RoundNotFinalizable,
    #[msg("The round cannot be cancelled")]
    RoundNotCancellable,
    #[msg("The player refund is not available")]
    RefundNotAvailable,
    #[msg("The token mint is invalid")]
    InvalidMint,
    #[msg("The token account is invalid")]
    InvalidTokenAccount,
    #[msg("The token amount is invalid")]
    InvalidTokenAmount,
    #[msg("The delegated validator does not match the round")]
    InvalidValidator,
    #[msg("Arithmetic overflow")]
    MathOverflow,
    #[msg("The payout ledger does not conserve the funded pool")]
    ConservationViolation,
    #[msg("The round address is invalid")]
    InvalidRoundAddress,
    #[msg("The pool must be empty before commitment")]
    PoolNotEmpty,
}
