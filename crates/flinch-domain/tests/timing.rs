use flinch_domain::{CohortWindow, DomainError, Ledger, SellerSet, TerminalReason};

#[test]
fn cohort_boundaries_are_anchored_to_round_start() {
    assert_eq!(CohortWindow::at(100, 100).unwrap().index(), 0);
    assert_eq!(CohortWindow::at(100, 101).unwrap().index(), 0);
    assert_eq!(CohortWindow::at(100, 102).unwrap().index(), 1);
    let last = CohortWindow::at(100, 189).unwrap();
    assert_eq!(
        (
            last.index(),
            last.opens_at(),
            last.closes_at(),
            last.expires_at()
        ),
        (44, 188, 190, 205)
    );
    for now in [99, 190, 191] {
        assert_eq!(CohortWindow::at(100, now), Err(DomainError::InvalidTime));
    }
}

#[test]
fn execution_and_expiry_have_disjoint_boundaries() {
    let original = Ledger::new([1; 32], 100, 100).unwrap();
    let exit = original
        .prepare_batch(SellerSet::new(1).unwrap(), [1, 0, 0, 0], 0)
        .unwrap();
    for (now, expected) in [
        (101, Err(DomainError::CohortOpen)),
        (102, Ok([100, 0, 0, 0])),
        (116, Ok([100, 0, 0, 0])),
        (117, Err(DomainError::BatchExpired)),
    ] {
        let mut ledger = original.clone();
        assert_eq!(ledger.apply_fill(&exit, 100, 100, now), expected);
        if expected.is_err() {
            assert_eq!(ledger, original);
        }
    }
    let mut ledger = original.clone();
    assert_eq!(
        ledger.expire_batch(&exit, 116),
        Err(DomainError::BatchNotExpired)
    );
    assert_eq!(ledger, original);
    ledger.expire_batch(&exit, 117).unwrap();
    assert_eq!(ledger.holdings(), original.holdings());
    assert_eq!(ledger.usdc_claims(), [0; 4]);
    assert_eq!(ledger.revision(), 1);
    assert_eq!(ledger.next_cohort(), 8);
    assert_eq!(
        ledger.expire_batch(&exit, 117),
        Err(DomainError::StaleBatch)
    );
    assert_eq!(
        ledger.apply_fill(&exit, 100, 100, 116),
        Err(DomainError::StaleBatch)
    );
}

#[test]
fn late_round_fill_produces_a_standoff_without_forced_losers() {
    let mut ledger = Ledger::new([1; 32], 100, 100).unwrap();
    let exit = ledger
        .prepare_batch(SellerSet::new(1).unwrap(), [1, 0, 0, 0], 44)
        .unwrap();
    ledger.apply_fill(&exit, 100, 100, 190).unwrap();
    assert_eq!(ledger.terminal(), Some(TerminalReason::Standoff));
    assert_eq!(ledger.holdings(), [0, 100, 100, 100]);
}

#[test]
fn expired_final_batch_preserves_every_holders_position() {
    let mut ledger = Ledger::new([1; 32], 100, 100).unwrap();
    let exit = ledger
        .prepare_batch(SellerSet::new(15).unwrap(), [1; 4], 44)
        .unwrap();
    ledger.expire_batch(&exit, 205).unwrap();
    assert_eq!(ledger.terminal(), Some(TerminalReason::Standoff));
    assert_eq!(ledger.holdings(), [100; 4]);
    ledger.assert_conserved().unwrap();
}

#[test]
fn settled_and_expired_cohorts_cannot_be_reopened() {
    let mut ledger = Ledger::new([1; 32], 100, 100).unwrap();
    let exit = ledger
        .prepare_batch(SellerSet::new(1).unwrap(), [1, 0, 0, 0], 0)
        .unwrap();
    ledger.apply_fill(&exit, 100, 100, 110).unwrap();
    assert_eq!(ledger.next_cohort(), 5);
    assert_eq!(
        ledger.prepare_batch(SellerSet::new(2).unwrap(), [0, 1, 0, 0], 4),
        Err(DomainError::InvalidTime)
    );
    assert!(ledger
        .prepare_batch(SellerSet::new(2).unwrap(), [0, 1, 0, 0], 5)
        .is_ok());
}

#[test]
fn invalid_configuration_and_overflow_are_rejected() {
    assert_eq!(
        Ledger::new([1; 32], 0, 100),
        Err(DomainError::InvalidAmount)
    );
    assert_eq!(
        Ledger::new([1; 32], u64::MAX, 100),
        Err(DomainError::Overflow)
    );
    assert_eq!(Ledger::new([1; 32], 100, -1), Err(DomainError::InvalidTime));
    assert_eq!(
        Ledger::new([1; 32], 100, i64::MAX - 100),
        Err(DomainError::Overflow)
    );
    assert_eq!(CohortWindow::new(100, 45), Err(DomainError::InvalidTime));
    assert_eq!(
        CohortWindow::new(100, u32::MAX),
        Err(DomainError::InvalidTime)
    );
    assert_eq!(CohortWindow::new(i64::MAX, 0), Err(DomainError::Overflow));
    assert_eq!(
        CohortWindow::at(i64::MIN, i64::MAX),
        Err(DomainError::Overflow)
    );
    assert_eq!(CohortWindow::at(-1, 0), Err(DomainError::InvalidTime));
}
