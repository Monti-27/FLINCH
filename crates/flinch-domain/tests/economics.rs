use flinch_domain::{DomainError, ExitEconomics, SellerSet};

#[test]
fn single_seller_rewards_every_remaining_holder() {
    let exit = ExitEconomics::calculate([100_000_000; 4], SellerSet::new(1).unwrap()).unwrap();
    assert_eq!(exit.penalties(), [250_000, 0, 0, 0]);
    assert_eq!(exit.net_inputs(), [99_750_000, 0, 0, 0]);
    assert_eq!(exit.remaining(), [0, 100_083_334, 100_083_333, 100_083_333]);
    assert_eq!(exit.total_input(), 99_750_000);
}

#[test]
fn simultaneous_sellers_never_reward_each_other() {
    let exit = ExitEconomics::calculate([100_000_000; 4], SellerSet::new(3).unwrap()).unwrap();
    assert_eq!(exit.penalties(), [250_000, 250_000, 0, 0]);
    assert_eq!(exit.remaining(), [0, 0, 100_250_000, 100_250_000]);
}

#[test]
fn all_remaining_sellers_pay_no_game_penalty() {
    let exit = ExitEconomics::calculate([0, 120, 0, 180], SellerSet::new(10).unwrap()).unwrap();
    assert_eq!(exit.penalties(), [0; 4]);
    assert_eq!(exit.remaining(), [0; 4]);
    assert_eq!(exit.total_input(), 300);
}

#[test]
fn penalty_includes_previously_earned_rewards() {
    let first = ExitEconomics::calculate([100_000_000; 4], SellerSet::new(1).unwrap()).unwrap();
    let second = ExitEconomics::calculate(first.remaining(), SellerSet::new(2).unwrap()).unwrap();
    assert_eq!(second.penalties()[1], 250_208);
    assert_eq!(second.net_inputs()[1], 99_833_126);
}

#[test]
fn invalid_seat_masks_and_sellers_are_rejected() {
    for bitmap in [0, 16, 255] {
        assert_eq!(SellerSet::new(bitmap), Err(DomainError::InvalidSellers));
    }
    let sellers = SellerSet::new(1).unwrap();
    assert_eq!(
        ExitEconomics::calculate([0, 100, 100, 100], sellers),
        Err(DomainError::NotHolding)
    );
    assert_eq!(
        ExitEconomics::calculate([100, 0, 0, 0], sellers),
        Err(DomainError::RoundTerminal)
    );
}

#[test]
fn every_subset_conserves_every_base_unit() {
    let stakes = [1, 3, 399, 400, 401, 10_001, 1_000_000, u64::MAX / 4];
    for stake in stakes {
        for mask in 1..16 {
            let exit = ExitEconomics::calculate([stake; 4], SellerSet::new(mask).unwrap()).unwrap();
            let remaining: u128 = exit.remaining().into_iter().map(u128::from).sum();
            assert_eq!(
                remaining + u128::from(exit.total_input()),
                u128::from(stake) * 4
            );
            for seat in 0..4 {
                if mask & (1 << seat) != 0 {
                    assert_eq!(exit.remaining()[seat], 0);
                    assert_eq!(exit.penalties()[seat] + exit.net_inputs()[seat], stake);
                }
            }
        }
    }
}

#[test]
fn a_pool_larger_than_u64_is_rejected() {
    assert_eq!(
        ExitEconomics::calculate([u64::MAX; 4], SellerSet::new(1).unwrap()),
        Err(DomainError::Overflow)
    );
}
