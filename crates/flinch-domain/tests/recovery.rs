use flinch_domain::{DomainError, Ledger, SellerSet, TerminalReason};

#[test]
fn recovery_needs_no_batch_and_unlocks_exact_unsold_entitlements() {
    let mut ledger = Ledger::new([1; 32], 100, 100).unwrap();
    let before = ledger.clone();
    assert_eq!(ledger.recover(219), Err(DomainError::RecoveryTooEarly));
    assert_eq!(ledger, before);
    ledger.recover(220).unwrap();
    assert_eq!(ledger.terminal(), Some(TerminalReason::Recovery));
    for seat in 0..4 {
        assert_eq!(ledger.claim_wsol(seat).unwrap(), 100);
    }
    assert_eq!(ledger.accounting().unwrap().claimed_wsol, 400);
    ledger.assert_conserved().unwrap();
}

#[test]
fn late_commit_cannot_settle_after_base_recovery() {
    let mut ledger = Ledger::new([1; 32], 100, 100).unwrap();
    let exit = ledger
        .prepare_batch(SellerSet::new(1).unwrap(), [1, 0, 0, 0], 44)
        .unwrap();
    ledger.recover(220).unwrap();
    let before = ledger.clone();
    assert_eq!(
        ledger.apply_fill(&exit, 100, 100, 220),
        Err(DomainError::RoundTerminal)
    );
    assert_eq!(
        ledger.expire_batch(&exit, 220),
        Err(DomainError::RoundTerminal)
    );
    assert_eq!(ledger.recover(220), Err(DomainError::RoundTerminal));
    assert_eq!(ledger, before);
}

#[test]
fn recovery_preserves_successful_sales_and_holder_bonuses() {
    let mut ledger = Ledger::new([1; 32], 100_000_000, 100).unwrap();
    let exit = ledger
        .prepare_batch(SellerSet::new(1).unwrap(), [1, 0, 0, 0], 0)
        .unwrap();
    ledger
        .apply_fill(&exit, 99_750_000, 10_000_000, 102)
        .unwrap();
    assert_eq!(ledger.claim_usdc(0).unwrap(), 10_000_000);
    ledger.recover(220).unwrap();
    assert_eq!(ledger.claim_wsol(0), Err(DomainError::NothingToClaim));
    assert_eq!(ledger.claim_wsol(1).unwrap(), 100_083_334);
    assert_eq!(ledger.claim_wsol(2).unwrap(), 100_083_333);
    assert_eq!(ledger.claim_wsol(3).unwrap(), 100_083_333);
    let totals = ledger.accounting().unwrap();
    assert_eq!(
        totals.swapped_wsol + totals.claimed_wsol,
        totals.initial_wsol
    );
    assert_eq!(totals.claimed_usdc, totals.received_usdc);
    ledger.assert_conserved().unwrap();
}

#[test]
fn claims_are_one_shot_and_invalid_claims_do_not_mutate() {
    let mut ledger = Ledger::new([1; 32], 100, 100).unwrap();
    let before = ledger.clone();
    assert_eq!(ledger.claim_wsol(0), Err(DomainError::RoundStillLive));
    assert_eq!(ledger.claim_usdc(0), Err(DomainError::NothingToClaim));
    assert_eq!(ledger.claim_usdc(4), Err(DomainError::InvalidSeat));
    assert_eq!(ledger.claim_wsol(usize::MAX), Err(DomainError::InvalidSeat));
    assert_eq!(ledger, before);
    let exit = ledger
        .prepare_batch(SellerSet::new(1).unwrap(), [1, 0, 0, 0], 0)
        .unwrap();
    ledger.apply_fill(&exit, 100, 100, 102).unwrap();
    assert_eq!(ledger.claim_usdc(0).unwrap(), 100);
    let before = ledger.clone();
    assert_eq!(ledger.claim_usdc(0), Err(DomainError::NothingToClaim));
    assert_eq!(ledger, before);
    ledger.recover(220).unwrap();
    assert_eq!(ledger.claim_wsol(1).unwrap(), 100);
    let before = ledger.clone();
    assert_eq!(ledger.claim_wsol(1), Err(DomainError::NothingToClaim));
    assert_eq!(ledger, before);
}

#[test]
fn earlier_usdc_claim_does_not_invalidate_a_pending_batch() {
    let mut ledger = Ledger::new([1; 32], 100, 100).unwrap();
    let first = ledger
        .prepare_batch(SellerSet::new(1).unwrap(), [1, 0, 0, 0], 0)
        .unwrap();
    ledger.apply_fill(&first, 100, 100, 102).unwrap();
    let second = ledger
        .prepare_batch(SellerSet::new(2).unwrap(), [0, 1, 0, 0], 1)
        .unwrap();
    ledger.claim_usdc(0).unwrap();
    ledger.apply_fill(&second, 100, 100, 104).unwrap();
    ledger.assert_conserved().unwrap();
    assert_eq!(ledger.revision(), 2);
}
