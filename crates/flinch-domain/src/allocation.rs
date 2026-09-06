use crate::{DomainError, Result, SEATS};

pub(crate) fn sum(values: &[u64; SEATS]) -> Result<u64> {
    values.iter().try_fold(0u64, |total, value| {
        total.checked_add(*value).ok_or(DomainError::Overflow)
    })
}

pub fn allocate_proportionally(amount: u64, weights: [u64; SEATS]) -> Result<[u64; SEATS]> {
    let total = sum(&weights)?;
    if total == 0 {
        return Err(DomainError::InvalidAmount);
    }
    let mut shares = [0u64; SEATS];
    let mut remainders = [0u128; SEATS];
    for seat in 0..SEATS {
        let numerator = u128::from(amount) * u128::from(weights[seat]);
        shares[seat] =
            u64::try_from(numerator / u128::from(total)).map_err(|_| DomainError::Overflow)?;
        remainders[seat] = numerator % u128::from(total);
    }
    let mut dust = amount
        .checked_sub(sum(&shares)?)
        .ok_or(DomainError::Overflow)?;
    let mut awarded = [false; SEATS];
    while dust > 0 {
        let mut best = None;
        for seat in 0..SEATS {
            if weights[seat] == 0 || awarded[seat] {
                continue;
            }
            if best.is_none_or(|previous| remainders[seat] > remainders[previous]) {
                best = Some(seat);
            }
        }
        let seat = best.ok_or(DomainError::ConservationViolation)?;
        shares[seat] = shares[seat].checked_add(1).ok_or(DomainError::Overflow)?;
        awarded[seat] = true;
        dust -= 1;
    }
    Ok(shares)
}
