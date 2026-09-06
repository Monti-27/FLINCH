use anchor_lang::prelude::*;

use crate::{constants::*, error::DomainResult, state::*};

#[derive(Accounts)]
pub struct ExpireBatch<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [LEDGER_SEED, ledger.host.as_ref(), &ledger.nonce.to_le_bytes()], bump = ledger.bump)]
    pub ledger: Account<'info, RoomLedger>,
    #[account(mut, seeds = [CONTROL_SEED, ledger.key().as_ref()], bump = control.bump)]
    pub control: Account<'info, RoomControl>,
    #[account(init, payer = payer, space = 8 + BatchReceipt::INIT_SPACE,
        seeds = [RECEIPT_SEED, ledger.key().as_ref(), &control.revision.to_le_bytes()], bump)]
    pub receipt: Account<'info, BatchReceipt>,
    pub system_program: Program<'info, System>,
}

pub fn handle_expire(ctx: Context<ExpireBatch>) -> Result<()> {
    let room = &mut ctx.accounts.ledger;
    let mut domain = room.domain(room.key())?;
    let batch = ctx.accounts.control.batch(room, room.key(), &domain)?;
    let now = Clock::get()?.unix_timestamp;
    domain.expire_batch(&batch, now).onchain()?;
    ctx.accounts.receipt.set_inner(BatchReceipt {
        version: VERSION,
        ledger: room.key(),
        revision: batch.revision(),
        sellers: batch.sellers().bitmap(),
        cohort_index: batch.window().index(),
        expired: true,
        executed_at: now,
        input: 0,
        output: 0,
        allocations: [0; 4],
    });
    room.store(&domain);
    ctx.accounts.control.resolve(&domain);
    Ok(())
}
