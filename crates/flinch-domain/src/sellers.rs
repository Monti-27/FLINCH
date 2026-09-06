use crate::{DomainError, Result, SEATS};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct SellerSet(u8);

impl SellerSet {
    pub fn new(bitmap: u8) -> Result<Self> {
        if bitmap == 0 || bitmap >= 1 << SEATS {
            return Err(DomainError::InvalidSellers);
        }
        Ok(Self(bitmap))
    }

    pub fn bitmap(self) -> u8 {
        self.0
    }

    pub fn contains(self, seat: usize) -> bool {
        seat < SEATS && self.0 & (1 << seat) != 0
    }

    pub fn count(self) -> u32 {
        self.0.count_ones()
    }
}
