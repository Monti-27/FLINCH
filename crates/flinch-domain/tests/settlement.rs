use flinch_domain::{DomainError, ExitBatch, Ledger, SellerSet, TerminalReason};

fn batch(ledger: &Ledger, bitmap: u8, index: u32) -> ExitBatch {
    let sellers = SellerSet::new(bitmap).unwrap();
    let minimum = core::array::from_fn(|seat| u64::from(sellers.contains(seat)));
    ledger.prepare_batch(sellers, minimum, index).unwrap()
}

fn fill(ledger: &mut Ledger, exit: &ExitBatch, output: u64) {
    ledger
        .apply_fill(
            exit,
            exit.economics().total_input(),
            output,
            exit.window().closes_at(),
        )
        .unwrap();
}

#[test]
fn three_exits_leave_one_holder_and_two_assets_reconcile() {
    let mut ledger = Ledger::new([1; 32], 100_000_000, 100).unwrap();
    for seat in 0..3 {
        let exit = batch(&ledger, 1 << seat, seat);
        fill(&mut ledger, &exit, 1_000_000);
        ledger.assert_conserved().unwrap();
    }
    assert_eq!(
        ledger.terminal(),
        Some(TerminalReason::OneHolder { seat: 3 })
    );
    assert_eq!(ledger.usdc_claims(), [1_000_000, 1_000_000, 1_000_000, 0]);
    assert_eq!(ledger.holdings(), [0, 0, 0, 100_458_958]);
    let accounting = ledger.accounting().unwrap();
    assert_eq!(
        accounting.swapped_wsol + accounting.remaining_wsol,
        400_000_000
    );
    assert_eq!(accounting.received_usdc, 3_000_000);
}

#[test]
fn all_sell_batch_receives_full_net_input_and_no_holder() {
    let mut ledger = Ledger::new([1; 32], 100_000_000, 100).unwrap();
    let exit = batch(&ledger, 15, 0);
    fill(&mut ledger, &exit, 4_000_003);
    assert_eq!(exit.economics().total_input(), 400_000_000);
    assert_eq!(ledger.terminal(), Some(TerminalReason::AllSold));
    assert_eq!(
        ledger.usdc_claims(),
        [1_000_001, 1_000_001, 1_000_001, 1_000_000]
    );
    ledger.assert_conserved().unwrap();
}

#[test]
fn a_filled_batch_cannot_be_replayed() {
    let mut ledger = Ledger::new([1; 32], 100_000_000, 100).unwrap();
    let exit = batch(&ledger, 1, 0);
    fill(&mut ledger, &exit, 1_000_000);
    let before = ledger.clone();
    assert_eq!(
        ledger.apply_fill(&exit, exit.economics().total_input(), 1_000_000, 103),
        Err(DomainError::StaleBatch)
    );
    assert_eq!(ledger, before);
}

#[test]
fn every_individual_minimum_is_enforced_not_just_the_sum() {
    let mut ledger = Ledger::new([1; 32], 100_000_000, 100).unwrap();
    let exit = ledger
        .prepare_batch(SellerSet::new(3).unwrap(), [90, 10, 0, 0], 0)
        .unwrap();
    let before = ledger.clone();
    assert_eq!(
        ledger.apply_fill(&exit, exit.economics().total_input(), 100, 102),
        Err(DomainError::MinimumNotMet)
    );
    assert_eq!(ledger, before);
    fill(&mut ledger, &exit, 180);
    assert_eq!(ledger.usdc_claims(), [90, 90, 0, 0]);
}

#[test]
fn failed_input_or_output_checks_leave_every_field_unchanged() {
    let mut ledger = Ledger::new([1; 32], 100_000_000, 100).unwrap();
    let exit = batch(&ledger, 1, 0);
    let before = ledger.clone();
    assert_eq!(
        ledger.apply_fill(&exit, exit.economics().total_input() - 1, 100, 102),
        Err(DomainError::InputMismatch)
    );
    assert_eq!(ledger, before);
    assert_eq!(
        ledger.apply_fill(&exit, exit.economics().total_input(), 0, 102),
        Err(DomainError::InvalidAmount)
    );
    assert_eq!(ledger, before);
}

#[test]
fn proposals_bind_round_time_and_entitlement_snapshot() {
    let mut ledger = Ledger::new([1; 32], 100_000_000, 100).unwrap();
    let before = ledger.clone();
    for (source, expected) in [
        (
            Ledger::new([2; 32], 100_000_000, 100).unwrap(),
            DomainError::WrongRound,
        ),
        (
            Ledger::new([1; 32], 200_000_000, 100).unwrap(),
            DomainError::SnapshotMismatch,
        ),
        (
            Ledger::new([1; 32], 100_000_000, 101).unwrap(),
            DomainError::SnapshotMismatch,
        ),
    ] {
        let exit = batch(&source, 1, 0);
        assert_eq!(
            ledger.apply_fill(&exit, exit.economics().total_input(), 100, 104),
            Err(expected)
        );
        assert_eq!(ledger, before);
    }
}

#[test]
fn minimum_vectors_must_match_sellers_exactly() {
    let ledger = Ledger::new([1; 32], 100, 100).unwrap();
    for minimum in [[0; 4], [1, 1, 0, 0], [0, 1, 0, 0]] {
        assert_eq!(
            ledger.prepare_batch(SellerSet::new(1).unwrap(), minimum, 0),
            Err(DomainError::InvalidMinimum)
        );
    }
    assert_eq!(
        ledger.prepare_batch(SellerSet::new(15).unwrap(), [u64::MAX; 4], 0),
        Err(DomainError::Overflow)
    );
}

#[test]
fn cumulative_usdc_overflow_is_atomic_even_after_a_claim() {
    let mut ledger = Ledger::new([1; 32], 100, 100).unwrap();
    let exit = batch(&ledger, 1, 0);
    fill(&mut ledger, &exit, u64::MAX);
    assert_eq!(ledger.claim_usdc(0).unwrap(), u64::MAX);
    let exit = batch(&ledger, 2, 1);
    let before = ledger.clone();
    assert_eq!(
        ledger.apply_fill(&exit, exit.economics().total_input(), 1, 104),
        Err(DomainError::Overflow)
    );
    assert_eq!(ledger, before);
}

#[test]
fn every_successful_partition_preserves_both_asset_ledgers() {
    fn visit(ledger: Ledger, index: u32, paths: &mut usize) {
        ledger.assert_conserved().unwrap();
        if ledger.terminal().is_some() {
            *paths += 1;
            let mut drained = ledger;
            for seat in 0..4 {
                if drained.usdc_claims()[seat] > 0 {
                    drained.claim_usdc(seat).unwrap();
                }
                if drained.holdings()[seat] > 0 {
                    drained.claim_wsol(seat).unwrap();
                }
                drained.assert_conserved().unwrap();
            }
            assert_eq!(drained.holdings(), [0; 4]);
            assert_eq!(drained.usdc_claims(), [0; 4]);
            return;
        }
        let active = ledger
            .holdings()
            .iter()
            .enumerate()
            .fold(0u8, |mask, (seat, amount)| {
                mask | if *amount > 0 { 1 << seat } else { 0 }
            });
        for mask in 1..16 {
            if mask & active != mask {
                continue;
            }
            let exit = batch(&ledger, mask, index);
            let mut next = ledger.clone();
            fill(&mut next, &exit, exit.economics().total_input());
            visit(next, index + 1, paths);
        }
    }
    for stake in [1, 399, 400, 401, 1_000_000, u64::MAX / 4] {
        let mut paths = 0;
        visit(Ledger::new([1; 32], stake, 100).unwrap(), 0, &mut paths);
        assert_eq!(paths, 75);
    }
}
