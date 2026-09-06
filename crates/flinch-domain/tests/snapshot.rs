use flinch_domain::{Ledger, SellerSet, TerminalReason};

fn assert_roundtrip(ledger: &Ledger) {
    assert_eq!(Ledger::restore(ledger.snapshot()).unwrap(), *ledger);
}

#[test]
fn restores_every_sale_partition_and_claim_state() {
    fn visit(ledger: Ledger, index: u32) {
        assert_roundtrip(&ledger);
        for seat in 0..4 {
            let mut claimed = ledger.clone();
            if claimed.claim_usdc(seat).is_ok() {
                assert_roundtrip(&claimed);
            }
        }
        if ledger.terminal().is_some() {
            let mut claimed = ledger;
            for seat in 0..4 {
                let _ = claimed.claim_wsol(seat);
                assert_roundtrip(&claimed);
            }
            return;
        }
        for mask in 1..16 {
            let sellers = SellerSet::new(mask).unwrap();
            let minimums = core::array::from_fn(|seat| u64::from(sellers.contains(seat)));
            if let Ok(batch) = ledger.prepare_batch(sellers, minimums, index) {
                let mut next = ledger.clone();
                next.apply_fill(
                    &batch,
                    batch.economics().total_input(),
                    101,
                    batch.window().closes_at(),
                )
                .unwrap();
                visit(next, index + 1);
            }
        }
    }
    visit(Ledger::new([7; 32], 1_000_001, 100).unwrap(), 0);
}

#[test]
fn restores_expiry_recovery_and_deadline_states() {
    let mut ledger = Ledger::new([1; 32], 100, 10).unwrap();
    let batch = ledger
        .prepare_batch(SellerSet::new(1).unwrap(), [1, 0, 0, 0], 0)
        .unwrap();
    ledger.expire_batch(&batch, 27).unwrap();
    assert_roundtrip(&ledger);
    ledger.recover(130).unwrap();
    for seat in 0..4 {
        ledger.claim_wsol(seat).unwrap();
        assert_roundtrip(&ledger);
    }
    let mut ledger = Ledger::new([1; 32], 100, 10).unwrap();
    let batch = ledger
        .prepare_batch(SellerSet::new(1).unwrap(), [1, 0, 0, 0], 44)
        .unwrap();
    ledger
        .apply_fill(&batch, batch.economics().total_input(), 10, 100)
        .unwrap();
    assert_eq!(ledger.terminal(), Some(TerminalReason::Standoff));
    assert_roundtrip(&ledger);
}

#[test]
fn rejects_inconsistent_serialized_fields() {
    let initial = Ledger::new([1; 32], 100, 10).unwrap().snapshot();
    let mutations: [fn(&mut flinch_domain::LedgerSnapshot); 16] = [
        |s: &mut flinch_domain::LedgerSnapshot| s.initial_wsol = 0,
        |s| s.initial_wsol += 1,
        |s| s.started_at = -1,
        |s| s.started_at = i64::MAX,
        |s| s.next_cohort = 45,
        |s| s.revision = 100,
        |s| s.holdings[0] += 1,
        |s| s.usdc_claims[0] = 1,
        |s| s.claimed_usdc = 1,
        |s| s.swapped_wsol = 1,
        |s| s.terminal = Some(TerminalReason::AllSold),
        |s| s.terminal = Some(TerminalReason::OneHolder { seat: 4 }),
        |s| s.terminal = Some(TerminalReason::Standoff),
        |s| {
            s.holdings[0] = 0;
            s.claimed_wsol = 100;
        },
        |s| {
            s.holdings[0] -= 1;
            s.holdings[1] += 1;
        },
        |s| {
            s.usdc_claims[0] = 1;
            s.received_usdc = 1;
        },
    ];
    for mutate in mutations {
        let mut invalid = initial.clone();
        mutate(&mut invalid);
        assert!(Ledger::restore(invalid).is_err());
    }
}

#[test]
fn restored_revision_still_rejects_replayed_batches() {
    let mut ledger = Ledger::new([1; 32], 100, 10).unwrap();
    let batch = ledger
        .prepare_batch(SellerSet::new(1).unwrap(), [1, 0, 0, 0], 0)
        .unwrap();
    ledger.apply_fill(&batch, 100, 10, 12).unwrap();
    let mut restored = Ledger::restore(ledger.snapshot()).unwrap();
    assert!(restored.apply_fill(&batch, 100, 10, 12).is_err());
    assert_eq!(restored, ledger);
}
