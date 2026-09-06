use flinch_domain::{allocate_proportionally, DomainError};

#[test]
fn largest_remainder_uses_seat_order_to_break_ties() {
    assert_eq!(
        allocate_proportionally(11, [1, 1, 1, 0]).unwrap(),
        [4, 4, 3, 0]
    );
    assert_eq!(
        allocate_proportionally(10, [1, 2, 0, 0]).unwrap(),
        [3, 7, 0, 0]
    );
    assert_eq!(
        allocate_proportionally(1, [0, 1, 1, 0]).unwrap(),
        [0, 1, 0, 0]
    );
}

#[test]
fn allocation_handles_wide_multiplication_without_float_rounding() {
    let shares = allocate_proportionally(u64::MAX, [u64::MAX - 1, 1, 0, 0]).unwrap();
    assert_eq!(shares, [u64::MAX - 1, 1, 0, 0]);
}

#[test]
fn invalid_total_weights_fail() {
    assert_eq!(
        allocate_proportionally(1, [0; 4]),
        Err(DomainError::InvalidAmount)
    );
    assert_eq!(
        allocate_proportionally(1, [u64::MAX; 4]),
        Err(DomainError::Overflow)
    );
}

#[test]
fn allocation_matches_floor_or_ceiling_and_conserves() {
    for a in 0..7 {
        for b in 0..7 {
            for c in 0..7 {
                let weights = [a, b, c, 1];
                let denominator: u64 = weights.iter().sum();
                for amount in 0..32 {
                    let shares = allocate_proportionally(amount, weights).unwrap();
                    assert_eq!(shares.iter().sum::<u64>(), amount);
                    for seat in 0..4 {
                        let floor = amount * weights[seat] / denominator;
                        assert!(shares[seat] == floor || shares[seat] == floor + 1);
                        if weights[seat] == 0 {
                            assert_eq!(shares[seat], 0);
                        }
                    }
                }
            }
        }
    }
}
