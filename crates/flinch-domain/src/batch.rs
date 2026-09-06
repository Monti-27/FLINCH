use crate::allocation::sum;
use crate::{
    allocate_proportionally, CohortWindow, DomainError, ExitEconomics, Result, SellerSet, SEATS,
};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ExitBatch {
    pub(crate) round: [u8; 32],
    pub(crate) revision: u64,
    pub(crate) holdings: [u64; SEATS],
    sellers: SellerSet,
    minimum_outputs: [u64; SEATS],
    economics: ExitEconomics,
    window: CohortWindow,
}

impl ExitBatch {
    pub(crate) fn new(
        round: [u8; 32],
        revision: u64,
        holdings: [u64; SEATS],
        sellers: SellerSet,
        minimum_outputs: [u64; SEATS],
        window: CohortWindow,
    ) -> Result<Self> {
        for (seat, minimum) in minimum_outputs.iter().enumerate() {
            if sellers.contains(seat) != (*minimum > 0) {
                return Err(DomainError::InvalidMinimum);
            }
        }
        sum(&minimum_outputs)?;
        let economics = ExitEconomics::calculate(holdings, sellers)?;
        Ok(Self {
            round,
            revision,
            holdings,
            sellers,
            minimum_outputs,
            economics,
            window,
        })
    }

    pub fn round(self) -> [u8; 32] {
        self.round
    }

    pub fn revision(self) -> u64 {
        self.revision
    }

    pub fn sellers(self) -> SellerSet {
        self.sellers
    }

    pub fn minimum_outputs(self) -> [u64; SEATS] {
        self.minimum_outputs
    }

    pub fn economics(self) -> ExitEconomics {
        self.economics
    }

    pub fn window(self) -> CohortWindow {
        self.window
    }

    pub fn allocate_output(self, received: u64) -> Result<[u64; SEATS]> {
        if received == 0 {
            return Err(DomainError::InvalidAmount);
        }
        let outputs = allocate_proportionally(received, self.economics.net_inputs())?;
        if outputs
            .iter()
            .zip(self.minimum_outputs)
            .any(|(actual, minimum)| *actual < minimum)
        {
            return Err(DomainError::MinimumNotMet);
        }
        Ok(outputs)
    }
}
