use anchor_lang::prelude::*;

use crate::constants::MAX_PLAYERS;
use crate::error::FlinchError;
use crate::state::PlayerSlot;

pub fn bitmap_indices(bitmap: u8) -> ([u8; MAX_PLAYERS], usize) {
    let mut indices = [0u8; MAX_PLAYERS];
    let mut count = 0usize;
    for index in 0..MAX_PLAYERS {
        if bitmap & (1 << index) != 0 {
            indices[count] = index as u8;
            count += 1;
        }
    }
    (indices, count)
}

pub fn sort_indices_by_wallet(indices: &mut [u8], players: &[PlayerSlot; MAX_PLAYERS]) {
    indices.sort_by_key(|index| players[*index as usize].wallet.to_bytes());
}

pub fn shuffle_indices(indices: &mut [u8], randomness: &[u8; 32]) -> Result<()> {
    if indices.len() < 2 {
        return Ok(());
    }
    let mut word_index = 0usize;
    for upper in (1..indices.len()).rev() {
        let bound = (upper + 1) as u64;
        let zone = u64::MAX - (u64::MAX % bound);
        let selected = loop {
            let end = word_index.checked_add(8).ok_or(FlinchError::MathOverflow)?;
            require!(end <= randomness.len(), FlinchError::RandomnessExhausted);
            let candidate = u64::from_le_bytes(
                randomness[word_index..end]
                    .try_into()
                    .map_err(|_| error!(FlinchError::RandomnessExhausted))?,
            );
            word_index = end;
            if candidate < zone {
                break (candidate % bound) as usize;
            }
        };
        indices.swap(upper, selected);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bitmap_is_decoded_in_seat_order() {
        let (indices, count) = bitmap_indices(0b1101);
        assert_eq!(count, 3);
        assert_eq!(&indices[..count], &[0, 2, 3]);
    }

    #[test]
    fn shuffle_is_deterministic_and_preserves_members() {
        let mut first = [0, 1, 2, 3];
        let mut second = first;
        let randomness = [17u8; 32];
        shuffle_indices(&mut first, &randomness).unwrap();
        shuffle_indices(&mut second, &randomness).unwrap();
        assert_eq!(first, second);
        first.sort();
        assert_eq!(first, [0, 1, 2, 3]);
    }
}
