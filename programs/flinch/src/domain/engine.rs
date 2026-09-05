use anchor_lang::prelude::*;

use crate::constants::{
    COHORT_DURATION_SECONDS, MAX_PLAYERS, MAX_SELLERS, ROUND_DURATION_SECONDS, VRF_TIMEOUT_SECONDS,
};
use crate::domain::{
    bitmap_indices, funded_pool, payout_for_rank, shuffle_indices, sort_indices_by_wallet,
    timeout_penalties,
};
use crate::error::FlinchError;
use crate::state::{
    Cohort, CohortStatus, PlayerSlot, PlayerStatus, Round, RoundStatus, TerminalReason, VrfState,
    VrfStatus,
};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ResolutionOutcome {
    Direct {
        cohort_index: u32,
        seller_bitmap: u8,
    },
    VrfRequested {
        cohort_index: u32,
        seller_bitmap: u8,
        request_nonce: u64,
    },
    Finalizing,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct ResolutionSummary {
    pub cohort_index: u32,
    pub seller_bitmap: u8,
    pub seller_count: u8,
    pub holder_index: u8,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct RoundConfig {
    pub host: Pubkey,
    pub host_nonce: u64,
    pub mint: Pubkey,
    pub validator: Pubkey,
    pub pool_token_account: Pubkey,
    pub price_account: Pubkey,
    pub price_feed_id: [u8; 32],
    pub stake: u64,
    pub created_at: i64,
    pub funding_deadline: i64,
    pub bump: u8,
}

impl Round {
    pub fn configure(&mut self, config: RoundConfig) -> Result<()> {
        require!(config.stake > 0, FlinchError::InvalidTokenAmount);
        funded_pool(config.stake)?;
        require!(
            config.funding_deadline > config.created_at,
            FlinchError::InvalidConfiguration
        );
        require!(
            config.host != Pubkey::default(),
            FlinchError::InvalidConfiguration
        );
        require!(
            config.validator != Pubkey::default(),
            FlinchError::InvalidValidator
        );
        require!(
            config.pool_token_account != Pubkey::default(),
            FlinchError::InvalidTokenAccount
        );
        *self = Round::empty();
        self.bump = config.bump;
        self.host = config.host;
        self.host_nonce = config.host_nonce;
        self.mint = config.mint;
        self.validator = config.validator;
        self.pool_token_account = config.pool_token_account;
        self.price_account = config.price_account;
        self.price_feed_id = config.price_feed_id;
        self.stake = config.stake;
        self.created_at = config.created_at;
        self.funding_deadline = config.funding_deadline;
        Ok(())
    }

    pub fn assert_address(&self, address: Pubkey) -> Result<()> {
        let nonce = self.host_nonce.to_le_bytes();
        let (expected, bump) = Pubkey::find_program_address(
            &[
                crate::constants::ROUND_SEED,
                self.host.as_ref(),
                nonce.as_ref(),
            ],
            &crate::ID,
        );
        require_keys_eq!(address, expected, FlinchError::InvalidRoundAddress);
        require!(self.bump == bump, FlinchError::InvalidRoundAddress);
        Ok(())
    }

    pub fn add_player(&mut self, wallet: Pubkey, token_account: Pubkey, now: i64) -> Result<u8> {
        require!(
            self.status == RoundStatus::Funding,
            FlinchError::RoundNotFunding
        );
        require!(now <= self.funding_deadline, FlinchError::FundingExpired);
        require!(
            wallet != Pubkey::default(),
            FlinchError::InvalidConfiguration
        );
        require!(
            token_account != Pubkey::default(),
            FlinchError::InvalidTokenAccount
        );
        require!(
            !self.players.iter().any(|seat| seat.wallet == wallet),
            FlinchError::PlayerAlreadyJoined
        );
        let index = self
            .players
            .iter()
            .position(|seat| seat.status == PlayerStatus::Empty)
            .ok_or(FlinchError::RoundFull)?;
        self.players[index] = PlayerSlot {
            wallet,
            token_account,
            status: PlayerStatus::Funded,
            ..PlayerSlot::default()
        };
        self.funded_count = self
            .funded_count
            .checked_add(1)
            .ok_or(FlinchError::MathOverflow)?;
        if self.funded_count as usize == MAX_PLAYERS {
            self.status = RoundStatus::Ready;
        }
        Ok(index as u8)
    }

    pub fn start(&mut self, authority: Pubkey, now: i64) -> Result<()> {
        require_keys_eq!(authority, self.host, FlinchError::UnauthorizedHost);
        require!(
            self.status == RoundStatus::Ready,
            FlinchError::RoundNotReady
        );
        require!(
            self.funded_count as usize == MAX_PLAYERS,
            FlinchError::RoundNotReady
        );
        self.started_at = now;
        self.ends_at = now
            .checked_add(ROUND_DURATION_SECONDS)
            .ok_or(FlinchError::MathOverflow)?;
        self.holding_count = self.funded_count;
        for player in &mut self.players {
            require!(
                player.status == PlayerStatus::Funded,
                FlinchError::RoundNotReady
            );
            player.status = PlayerStatus::Holding;
        }
        self.status = RoundStatus::Live;
        Ok(())
    }

    pub fn cancel(&mut self, authority: Pubkey, now: i64) -> Result<()> {
        require!(
            matches!(self.status, RoundStatus::Funding | RoundStatus::Ready),
            FlinchError::RoundNotCancellable
        );
        require!(
            authority == self.host || now > self.funding_deadline,
            FlinchError::RoundNotCancellable
        );
        self.status = RoundStatus::Cancelled;
        self.terminal_reason = TerminalReason::Cancelled;
        Ok(())
    }

    pub fn refund_index(&self, wallet: Pubkey) -> Result<usize> {
        require!(
            self.status == RoundStatus::Cancelled,
            FlinchError::RefundNotAvailable
        );
        let index = self.player_index(wallet)?;
        require!(
            self.players[index].status == PlayerStatus::Funded,
            FlinchError::RefundNotAvailable
        );
        require!(
            !self.players[index].payout_claimed,
            FlinchError::PayoutAlreadyClaimed
        );
        Ok(index)
    }

    pub fn record_refund(&mut self, index: usize) -> Result<()> {
        require!(index < MAX_PLAYERS, FlinchError::PlayerNotFound);
        require!(
            self.players[index].status == PlayerStatus::Funded,
            FlinchError::RefundNotAvailable
        );
        self.players[index].status = PlayerStatus::Refunded;
        self.players[index].payout = self.stake;
        self.players[index].payout_claimed = true;
        self.total_paid = self
            .total_paid
            .checked_add(self.stake)
            .ok_or(FlinchError::MathOverflow)?;
        Ok(())
    }

    pub fn expected_cancelled_total(&self) -> Result<u64> {
        self.stake
            .checked_mul(self.funded_count as u64)
            .ok_or_else(|| error!(FlinchError::MathOverflow))
    }

    pub fn queue_sell(&mut self, wallet: Pubkey, action_nonce: u64, now: i64) -> Result<u32> {
        require!(self.status == RoundStatus::Live, FlinchError::RoundNotLive);
        require!(now >= self.started_at, FlinchError::RoundNotLive);
        require!(now < self.ends_at, FlinchError::RoundEnded);
        require!(self.holding_count > 1, FlinchError::FinalHolderCannotSell);
        require!(
            self.active_cohort.status != CohortStatus::AwaitingVrf,
            FlinchError::CohortNeedsResolution
        );
        let player_index = self.player_index(wallet)?;
        let player = &self.players[player_index];
        require!(
            player.status == PlayerStatus::Holding,
            FlinchError::PlayerNotHolding
        );
        require!(
            action_nonce > player.last_action_nonce,
            FlinchError::InvalidActionNonce
        );
        let cohort_index = self.cohort_index(now)?;
        match self.active_cohort.status {
            CohortStatus::Empty => {
                self.active_cohort = Cohort {
                    index: cohort_index,
                    closes_at: self.cohort_closes_at(cohort_index)?,
                    seller_bitmap: 0,
                    seller_count: 0,
                    terminal: false,
                    status: CohortStatus::Open,
                };
            }
            CohortStatus::Open => {
                require!(
                    self.active_cohort.index == cohort_index,
                    FlinchError::CohortNeedsResolution
                );
            }
            CohortStatus::AwaitingVrf => return err!(FlinchError::CohortNeedsResolution),
        }
        self.active_cohort.seller_bitmap |= 1 << player_index;
        self.active_cohort.seller_count = self
            .active_cohort
            .seller_count
            .checked_add(1)
            .ok_or(FlinchError::MathOverflow)?;
        let player = &mut self.players[player_index];
        player.status = PlayerStatus::PendingSell;
        player.sell_cohort = cohort_index;
        player.sell_timestamp = now;
        player.last_action_nonce = action_nonce;
        Ok(cohort_index)
    }

    pub fn prepare_resolution(&mut self, now: i64) -> Result<ResolutionOutcome> {
        require!(
            matches!(self.status, RoundStatus::Live | RoundStatus::TiePending),
            FlinchError::RoundNotLive
        );
        require!(
            self.status != RoundStatus::TiePending,
            FlinchError::VrfRequired
        );
        if self.active_cohort.status == CohortStatus::Empty {
            if now < self.ends_at {
                return err!(FlinchError::EmptyCohort);
            }
            if self.holding_count == 1 {
                self.mark_final_holder()?;
                self.status = RoundStatus::Finalizing;
                self.terminal_reason = TerminalReason::TimerExpired;
                return Ok(ResolutionOutcome::Finalizing);
            }
            self.open_terminal_cohort(now)?;
        }
        require!(
            self.active_cohort.status == CohortStatus::Open,
            FlinchError::CohortAlreadyResolved
        );
        require!(
            now >= self.active_cohort.closes_at,
            FlinchError::CohortStillOpen
        );
        let cohort_index = self.active_cohort.index;
        let seller_bitmap = self.active_cohort.seller_bitmap;
        let seller_count = self.active_cohort.seller_count;
        require!(seller_count > 0, FlinchError::EmptyCohort);
        let rank_count = seller_count.min(self.holding_count.saturating_sub(1));
        if seller_count == 1 && rank_count == 1 {
            let (indices, count) = bitmap_indices(seller_bitmap);
            require!(count == 1, FlinchError::InvalidConfiguration);
            self.assign_seller(indices[0] as usize, None)?;
            self.finish_cohort()?;
            return Ok(ResolutionOutcome::Direct {
                cohort_index,
                seller_bitmap,
            });
        }
        let request_nonce = self
            .vrf
            .request_nonce
            .checked_add(1)
            .ok_or(FlinchError::MathOverflow)?;
        self.vrf = VrfState {
            request_nonce,
            cohort_index,
            seller_bitmap,
            first_rank: self.next_sell_rank,
            rank_count,
            requested_at: now,
            status: VrfStatus::Requested,
        };
        self.active_cohort.status = CohortStatus::AwaitingVrf;
        self.status = RoundStatus::TiePending;
        Ok(ResolutionOutcome::VrfRequested {
            cohort_index,
            seller_bitmap,
            request_nonce,
        })
    }

    pub fn resolve_vrf(
        &mut self,
        request_nonce: u64,
        randomness: [u8; 32],
    ) -> Result<ResolutionSummary> {
        self.validate_vrf_request(request_nonce)?;
        let snapshot = self.active_cohort;
        let (mut indices, count) = bitmap_indices(snapshot.seller_bitmap);
        require!(
            count == snapshot.seller_count as usize,
            FlinchError::InvalidConfiguration
        );
        shuffle_indices(&mut indices[..count], &randomness)?;
        let seller_count = self.vrf.rank_count as usize;
        require!(seller_count <= count, FlinchError::InvalidConfiguration);
        let holder_index = if seller_count < count {
            let value = indices[count - 1];
            self.players[value as usize].status = PlayerStatus::Holding;
            value
        } else {
            u8::MAX
        };
        for index in indices[..seller_count].iter().copied() {
            self.assign_seller(index as usize, None)?;
        }
        self.vrf.status = VrfStatus::Fulfilled;
        self.finish_cohort()?;
        Ok(ResolutionSummary {
            cohort_index: snapshot.index,
            seller_bitmap: snapshot.seller_bitmap,
            seller_count: seller_count as u8,
            holder_index,
        })
    }

    pub fn resolve_vrf_timeout(&mut self, now: i64) -> Result<ResolutionSummary> {
        self.validate_vrf_request(self.vrf.request_nonce)?;
        let timeout_at = self
            .vrf
            .requested_at
            .checked_add(VRF_TIMEOUT_SECONDS)
            .ok_or(FlinchError::MathOverflow)?;
        require!(now >= timeout_at, FlinchError::VrfTimeoutNotReached);
        let snapshot = self.active_cohort;
        let (mut indices, count) = bitmap_indices(snapshot.seller_bitmap);
        require!(
            count == snapshot.seller_count as usize,
            FlinchError::InvalidConfiguration
        );
        sort_indices_by_wallet(&mut indices[..count], &self.players);
        let seller_count = self.vrf.rank_count as usize;
        require!(
            seller_count > 0 && seller_count <= MAX_SELLERS,
            FlinchError::InvalidConfiguration
        );
        require!(seller_count <= count, FlinchError::InvalidConfiguration);
        let seller_start = count - seller_count;
        let holder_index = if seller_start == 1 {
            let value = indices[0];
            self.players[value as usize].status = PlayerStatus::Holding;
            value
        } else {
            u8::MAX
        };
        let penalties = timeout_penalties(self.stake, self.vrf.first_rank, seller_count as u8)?;
        for (offset, index) in indices[seller_start..count].iter().copied().enumerate() {
            self.assign_seller(index as usize, Some(penalties[offset]))?;
        }
        self.vrf.status = VrfStatus::TimedOut;
        self.finish_cohort()?;
        Ok(ResolutionSummary {
            cohort_index: snapshot.index,
            seller_bitmap: snapshot.seller_bitmap,
            seller_count: seller_count as u8,
            holder_index,
        })
    }

    pub fn player_index(&self, wallet: Pubkey) -> Result<usize> {
        self.players
            .iter()
            .position(|player| player.wallet == wallet && player.status != PlayerStatus::Empty)
            .ok_or_else(|| error!(FlinchError::PlayerNotFound))
    }

    fn cohort_index(&self, now: i64) -> Result<u32> {
        let elapsed = now
            .checked_sub(self.started_at)
            .ok_or(FlinchError::MathOverflow)?;
        require!(elapsed >= 0, FlinchError::RoundNotLive);
        u32::try_from(elapsed / COHORT_DURATION_SECONDS)
            .map_err(|_| error!(FlinchError::MathOverflow))
    }

    fn cohort_closes_at(&self, index: u32) -> Result<i64> {
        let offset = (index as i64)
            .checked_add(1)
            .and_then(|value| value.checked_mul(COHORT_DURATION_SECONDS))
            .ok_or(FlinchError::MathOverflow)?;
        self.started_at
            .checked_add(offset)
            .ok_or_else(|| error!(FlinchError::MathOverflow))
    }

    fn open_terminal_cohort(&mut self, now: i64) -> Result<()> {
        let cohort_index = self.cohort_index(now)?;
        let mut bitmap = 0u8;
        let mut count = 0u8;
        for (index, player) in self.players.iter_mut().enumerate() {
            if player.status == PlayerStatus::Holding {
                player.status = PlayerStatus::PendingSell;
                player.sell_cohort = cohort_index;
                player.sell_timestamp = now;
                bitmap |= 1 << index;
                count = count.checked_add(1).ok_or(FlinchError::MathOverflow)?;
            }
        }
        require!(count > 1, FlinchError::RoundNotFinalizable);
        self.active_cohort = Cohort {
            index: cohort_index,
            closes_at: now,
            seller_bitmap: bitmap,
            seller_count: count,
            terminal: true,
            status: CohortStatus::Open,
        };
        self.terminal_reason = TerminalReason::TimerExpired;
        Ok(())
    }

    fn validate_vrf_request(&self, request_nonce: u64) -> Result<()> {
        require!(
            self.status == RoundStatus::TiePending,
            FlinchError::VrfNotPending
        );
        require!(
            self.vrf.status == VrfStatus::Requested,
            FlinchError::VrfNotPending
        );
        require!(
            self.vrf.request_nonce == request_nonce,
            FlinchError::InvalidVrfRequest
        );
        require!(
            self.vrf.cohort_index == self.active_cohort.index,
            FlinchError::InvalidVrfRequest
        );
        require!(
            self.vrf.seller_bitmap == self.active_cohort.seller_bitmap,
            FlinchError::InvalidVrfRequest
        );
        Ok(())
    }

    fn assign_seller(&mut self, index: usize, penalty: Option<u64>) -> Result<()> {
        require!(index < MAX_PLAYERS, FlinchError::PlayerNotFound);
        require!(
            self.players[index].status == PlayerStatus::PendingSell,
            FlinchError::PlayerNotHolding
        );
        let rank = self.next_sell_rank;
        require!(
            rank as usize <= MAX_SELLERS,
            FlinchError::FinalHolderCannotSell
        );
        let penalty = penalty.unwrap_or(payout_for_rank(self.stake, rank).and_then(|payout| {
            self.stake
                .checked_sub(payout)
                .ok_or_else(|| error!(FlinchError::MathOverflow))
        })?);
        let payout = self
            .stake
            .checked_sub(penalty)
            .ok_or(FlinchError::MathOverflow)?;
        let player = &mut self.players[index];
        player.status = PlayerStatus::Sold;
        player.sell_rank = rank;
        player.penalty_paid = penalty;
        player.payout = payout;
        player.payout_claimed = false;
        self.next_sell_rank = self
            .next_sell_rank
            .checked_add(1)
            .ok_or(FlinchError::MathOverflow)?;
        self.holding_count = self
            .holding_count
            .checked_sub(1)
            .ok_or(FlinchError::MathOverflow)?;
        Ok(())
    }

    fn finish_cohort(&mut self) -> Result<()> {
        self.active_cohort = Cohort::default();
        if self.holding_count == 1 {
            self.mark_final_holder()?;
            self.status = RoundStatus::Finalizing;
            if self.terminal_reason == TerminalReason::None {
                self.terminal_reason = TerminalReason::OneHolder;
            }
        } else {
            self.status = RoundStatus::Live;
        }
        Ok(())
    }

    fn mark_final_holder(&mut self) -> Result<()> {
        let mut found = false;
        for player in &mut self.players {
            if matches!(
                player.status,
                PlayerStatus::Holding | PlayerStatus::PendingSell
            ) {
                require!(!found, FlinchError::RoundNotFinalizable);
                player.status = PlayerStatus::FinalHolder;
                found = true;
            }
        }
        require!(found, FlinchError::RoundNotFinalizable);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn funded_round() -> Round {
        let mut round = Round::empty();
        round
            .configure(RoundConfig {
                host: Pubkey::new_unique(),
                host_nonce: 7,
                mint: crate::constants::WSOL_MINT,
                validator: Pubkey::new_unique(),
                pool_token_account: Pubkey::new_unique(),
                price_account: Pubkey::new_unique(),
                price_feed_id: [9; 32],
                stake: 100_000_000,
                created_at: 100,
                funding_deadline: 200,
                bump: 1,
            })
            .unwrap();
        for _ in 0..MAX_PLAYERS {
            round
                .add_player(Pubkey::new_unique(), Pubkey::new_unique(), 110)
                .unwrap();
        }
        round
    }

    fn live_round() -> Round {
        let mut round = funded_round();
        round.start(round.host, 120).unwrap();
        round
    }

    #[test]
    fn direct_sell_assigns_first_rank() {
        let mut round = live_round();
        let seller = round.players[0].wallet;
        assert_eq!(round.queue_sell(seller, 1, 121).unwrap(), 0);
        assert!(matches!(
            round.prepare_resolution(122).unwrap(),
            ResolutionOutcome::Direct { .. }
        ));
        assert_eq!(round.players[0].status, PlayerStatus::Sold);
        assert_eq!(round.players[0].sell_rank, 1);
        assert_eq!(round.players[0].payout, 80_000_000);
        assert_eq!(round.holding_count, 3);
    }

    #[test]
    fn duplicate_sell_is_rejected() {
        let mut round = live_round();
        let seller = round.players[0].wallet;
        round.queue_sell(seller, 1, 121).unwrap();
        assert!(round.queue_sell(seller, 2, 121).is_err());
    }

    #[test]
    fn host_can_cancel_before_funding_deadline() {
        let mut round = funded_round();
        round.cancel(round.host, 150).unwrap();
        assert_eq!(round.status, RoundStatus::Cancelled);
        assert_eq!(round.terminal_reason, TerminalReason::Cancelled);
    }

    #[test]
    fn non_host_can_only_cancel_after_funding_deadline() {
        let mut round = funded_round();
        let caller = Pubkey::new_unique();
        assert!(round.cancel(caller, 200).is_err());
        round.cancel(caller, 201).unwrap();
        assert_eq!(round.status, RoundStatus::Cancelled);
    }

    #[test]
    fn cancelled_player_refund_is_one_shot() {
        let mut round = funded_round();
        round.cancel(round.host, 150).unwrap();
        let wallet = round.players[0].wallet;
        let index = round.refund_index(wallet).unwrap();
        round.record_refund(index).unwrap();
        assert_eq!(round.players[index].status, PlayerStatus::Refunded);
        assert_eq!(round.players[index].payout, round.stake);
        assert_eq!(round.total_paid, round.stake);
        assert!(round.refund_index(wallet).is_err());
    }

    #[test]
    fn tie_timeout_preserves_rank_penalty_total() {
        let mut round = live_round();
        let first = round.players[0].wallet;
        let second = round.players[1].wallet;
        round.queue_sell(first, 1, 121).unwrap();
        round.queue_sell(second, 1, 121).unwrap();
        let outcome = round.prepare_resolution(122).unwrap();
        let request_nonce = match outcome {
            ResolutionOutcome::VrfRequested { request_nonce, .. } => request_nonce,
            _ => panic!("expected VRF request"),
        };
        assert_eq!(request_nonce, 1);
        assert!(round.resolve_vrf_timeout(131).is_err());
        round.resolve_vrf_timeout(132).unwrap();
        let penalty_total = round.players[..2]
            .iter()
            .map(|player| player.penalty_paid)
            .sum::<u64>();
        assert_eq!(penalty_total, 32_000_000);
        assert_eq!(round.holding_count, 2);
    }

    #[test]
    fn timer_creates_one_final_holder() {
        let mut round = live_round();
        let outcome = round.prepare_resolution(210).unwrap();
        let request_nonce = match outcome {
            ResolutionOutcome::VrfRequested { request_nonce, .. } => request_nonce,
            _ => panic!("expected terminal VRF request"),
        };
        round.resolve_vrf(request_nonce, [7; 32]).unwrap();
        assert_eq!(round.holding_count, 1);
        assert_eq!(
            round
                .players
                .iter()
                .filter(|player| player.status == PlayerStatus::FinalHolder)
                .count(),
            1
        );
        assert_eq!(round.status, RoundStatus::Finalizing);
    }

    #[test]
    fn terminal_timeout_selects_lowest_wallet_and_conserves_value() {
        let mut round = live_round();
        let expected_holder = round
            .players
            .iter()
            .map(|player| player.wallet)
            .min()
            .unwrap();
        let outcome = round.prepare_resolution(210).unwrap();
        assert!(matches!(outcome, ResolutionOutcome::VrfRequested { .. }));
        round.resolve_vrf_timeout(220).unwrap();
        let holder = round
            .players
            .iter()
            .find(|player| player.status == PlayerStatus::FinalHolder)
            .unwrap();
        let seller_payouts = round
            .players
            .iter()
            .filter(|player| player.status == PlayerStatus::Sold)
            .map(|player| player.payout)
            .sum::<u64>();
        let holder_payout = crate::domain::funded_pool(round.stake).unwrap() - seller_payouts;
        assert_eq!(holder.wallet, expected_holder);
        assert_eq!(round.status, RoundStatus::Finalizing);
        assert_eq!(
            seller_payouts + holder_payout,
            crate::domain::funded_pool(round.stake).unwrap()
        );
    }

    #[test]
    fn fulfilled_vrf_cannot_be_replayed() {
        let mut round = live_round();
        let first = round.players[0].wallet;
        let second = round.players[1].wallet;
        round.queue_sell(first, 1, 121).unwrap();
        round.queue_sell(second, 1, 121).unwrap();
        let request_nonce = match round.prepare_resolution(122).unwrap() {
            ResolutionOutcome::VrfRequested { request_nonce, .. } => request_nonce,
            _ => panic!("expected VRF request"),
        };
        round.resolve_vrf(request_nonce, [11; 32]).unwrap();
        assert!(round.resolve_vrf(request_nonce, [11; 32]).is_err());
    }
}
