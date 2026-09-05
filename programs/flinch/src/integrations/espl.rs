use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::invoke;
use anchor_spl::associated_token::get_associated_token_address;
use ephemeral_rollups_sdk::{
    consts::ESPL_TOKEN_PROGRAM_ID,
    pda::{
        delegate_buffer_pda_from_delegated_account_and_owner_program,
        delegation_metadata_pda_from_delegated_account,
        delegation_record_pda_from_delegated_account,
    },
};
use ephemeral_spl_api::{
    instruction::ESplInstruction,
    instructions::DelegateArgs,
    state::{ephemeral_ata::EphemeralAta, global_vault::GlobalVault},
};
use wheels::layout::Encodable;

pub fn ephemeral_ata(owner: &Pubkey, mint: &Pubkey) -> Pubkey {
    let (address, _) = EphemeralAta::find_pda(&owner.to_bytes().into(), &mint.to_bytes().into());
    Pubkey::new_from_array(address.to_bytes())
}

pub fn global_vault(mint: &Pubkey) -> Pubkey {
    let (address, _) = GlobalVault::find_pda(&mint.to_bytes().into());
    Pubkey::new_from_array(address.to_bytes())
}

pub fn vault_token_account(mint: &Pubkey) -> Pubkey {
    get_associated_token_address(&global_vault(mint), mint)
}

pub fn delegation_buffer(account: &Pubkey) -> Pubkey {
    delegate_buffer_pda_from_delegated_account_and_owner_program(account, &ESPL_TOKEN_PROGRAM_ID)
}

pub fn delegation_record(account: &Pubkey) -> Pubkey {
    delegation_record_pda_from_delegated_account(account)
}

pub fn delegation_metadata(account: &Pubkey) -> Pubkey {
    delegation_metadata_pda_from_delegated_account(account)
}

pub struct PoolCustodyAccounts<'a, 'info> {
    pub payer: &'a Signer<'info>,
    pub owner: AccountInfo<'info>,
    pub mint: AccountInfo<'info>,
    pub pool_ephemeral_ata: AccountInfo<'info>,
    pub global_vault: AccountInfo<'info>,
    pub vault_ephemeral_ata: AccountInfo<'info>,
    pub vault_token_account: AccountInfo<'info>,
    pub pool_delegation_buffer: AccountInfo<'info>,
    pub pool_delegation_record: AccountInfo<'info>,
    pub pool_delegation_metadata: AccountInfo<'info>,
    pub vault_delegation_buffer: AccountInfo<'info>,
    pub vault_delegation_record: AccountInfo<'info>,
    pub vault_delegation_metadata: AccountInfo<'info>,
    pub ephemeral_token_program: AccountInfo<'info>,
    pub delegation_program: AccountInfo<'info>,
    pub token_program: AccountInfo<'info>,
    pub associated_token_program: AccountInfo<'info>,
    pub system_program: AccountInfo<'info>,
}

pub fn initialize_pool_custody(
    accounts: PoolCustodyAccounts<'_, '_>,
    validator: Pubkey,
) -> Result<()> {
    let initialize_pool = initialize_ephemeral_ata_instruction(
        accounts.pool_ephemeral_ata.key(),
        accounts.payer.key(),
        accounts.owner.key(),
        accounts.mint.key(),
        accounts.system_program.key(),
    );
    invoke(
        &initialize_pool,
        &[
            accounts.pool_ephemeral_ata.clone(),
            accounts.payer.to_account_info(),
            accounts.owner.clone(),
            accounts.mint.clone(),
            accounts.system_program.clone(),
        ],
    )?;

    let initialize_vault = initialize_global_vault_instruction(
        accounts.global_vault.key(),
        accounts.payer.key(),
        accounts.mint.key(),
        accounts.vault_ephemeral_ata.key(),
        accounts.vault_token_account.key(),
        accounts.token_program.key(),
        accounts.associated_token_program.key(),
        accounts.system_program.key(),
    );
    invoke(
        &initialize_vault,
        &[
            accounts.global_vault.clone(),
            accounts.payer.to_account_info(),
            accounts.mint.clone(),
            accounts.vault_ephemeral_ata.clone(),
            accounts.vault_token_account.clone(),
            accounts.token_program.clone(),
            accounts.associated_token_program.clone(),
            accounts.system_program.clone(),
        ],
    )?;

    delegate_ephemeral_ata(
        &accounts,
        accounts.vault_ephemeral_ata.clone(),
        accounts.vault_delegation_buffer.clone(),
        accounts.vault_delegation_record.clone(),
        accounts.vault_delegation_metadata.clone(),
        validator,
    )?;

    delegate_ephemeral_ata(
        &accounts,
        accounts.pool_ephemeral_ata.clone(),
        accounts.pool_delegation_buffer.clone(),
        accounts.pool_delegation_record.clone(),
        accounts.pool_delegation_metadata.clone(),
        validator,
    )?;

    Ok(())
}

fn delegate_ephemeral_ata<'info>(
    accounts: &PoolCustodyAccounts<'_, 'info>,
    ephemeral_ata: AccountInfo<'info>,
    delegation_buffer: AccountInfo<'info>,
    delegation_record: AccountInfo<'info>,
    delegation_metadata: AccountInfo<'info>,
    validator: Pubkey,
) -> Result<()> {
    let instruction = delegate_ephemeral_ata_instruction(
        accounts.payer.key(),
        ephemeral_ata.key(),
        accounts.ephemeral_token_program.key(),
        delegation_buffer.key(),
        delegation_record.key(),
        delegation_metadata.key(),
        accounts.delegation_program.key(),
        accounts.system_program.key(),
        validator,
    )?;
    invoke(
        &instruction,
        &[
            accounts.payer.to_account_info(),
            ephemeral_ata,
            accounts.ephemeral_token_program.clone(),
            delegation_buffer,
            delegation_record,
            delegation_metadata,
            accounts.delegation_program.clone(),
            accounts.system_program.clone(),
        ],
    )?;
    Ok(())
}

fn initialize_ephemeral_ata_instruction(
    ephemeral_ata: Pubkey,
    payer: Pubkey,
    owner: Pubkey,
    mint: Pubkey,
    system_program: Pubkey,
) -> Instruction {
    Instruction {
        program_id: ESPL_TOKEN_PROGRAM_ID,
        accounts: vec![
            AccountMeta::new(ephemeral_ata, false),
            AccountMeta::new(payer, true),
            AccountMeta::new_readonly(owner, false),
            AccountMeta::new_readonly(mint, false),
            AccountMeta::new_readonly(system_program, false),
        ],
        data: ESplInstruction::InitializeEphemeralAta.to_vec(),
    }
}

#[allow(clippy::too_many_arguments)]
fn initialize_global_vault_instruction(
    vault: Pubkey,
    payer: Pubkey,
    mint: Pubkey,
    vault_ephemeral_ata: Pubkey,
    vault_token_account: Pubkey,
    token_program: Pubkey,
    associated_token_program: Pubkey,
    system_program: Pubkey,
) -> Instruction {
    Instruction {
        program_id: ESPL_TOKEN_PROGRAM_ID,
        accounts: vec![
            AccountMeta::new(vault, false),
            AccountMeta::new(payer, true),
            AccountMeta::new_readonly(mint, false),
            AccountMeta::new(vault_ephemeral_ata, false),
            AccountMeta::new(vault_token_account, false),
            AccountMeta::new_readonly(token_program, false),
            AccountMeta::new_readonly(associated_token_program, false),
            AccountMeta::new_readonly(system_program, false),
        ],
        data: ESplInstruction::InitializeGlobalVault.to_vec(),
    }
}

#[allow(clippy::too_many_arguments)]
fn delegate_ephemeral_ata_instruction(
    payer: Pubkey,
    ephemeral_ata: Pubkey,
    owner_program: Pubkey,
    delegation_buffer: Pubkey,
    delegation_record: Pubkey,
    delegation_metadata: Pubkey,
    delegation_program: Pubkey,
    system_program: Pubkey,
    validator: Pubkey,
) -> Result<Instruction> {
    let args = DelegateArgs {
        validator: Some(validator.to_bytes().into()),
    }
    .encode()
    .map_err(|_| ProgramError::InvalidInstructionData)?;
    Ok(Instruction {
        program_id: ESPL_TOKEN_PROGRAM_ID,
        accounts: vec![
            AccountMeta::new(payer, true),
            AccountMeta::new(ephemeral_ata, false),
            AccountMeta::new_readonly(owner_program, false),
            AccountMeta::new(delegation_buffer, false),
            AccountMeta::new(delegation_record, false),
            AccountMeta::new(delegation_metadata, false),
            AccountMeta::new_readonly(delegation_program, false),
            AccountMeta::new_readonly(system_program, false),
        ],
        data: ESplInstruction::DelegateEphemeralAta.with_data(&args),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn api_and_sdk_program_ids_match() {
        assert_eq!(
            Pubkey::new_from_array(ephemeral_spl_api::ID.to_bytes()),
            ESPL_TOKEN_PROGRAM_ID
        );
    }

    #[test]
    fn pool_addresses_use_the_pinned_api() {
        let owner = Pubkey::new_unique();
        let mint = Pubkey::new_unique();
        let vault = global_vault(&mint);
        let expected_eata =
            EphemeralAta::find_pda(&owner.to_bytes().into(), &mint.to_bytes().into()).0;
        let expected_vault = GlobalVault::find_pda(&mint.to_bytes().into()).0;
        assert_eq!(
            ephemeral_ata(&owner, &mint).to_bytes(),
            expected_eata.to_bytes()
        );
        assert_eq!(vault.to_bytes(), expected_vault.to_bytes());
        assert_eq!(
            vault_token_account(&mint),
            get_associated_token_address(&vault, &mint)
        );
    }

    #[test]
    fn custody_instructions_preserve_upstream_layouts() {
        let keys = std::array::from_fn::<_, 9, _>(|_| Pubkey::new_unique());
        let initialize =
            initialize_ephemeral_ata_instruction(keys[0], keys[1], keys[2], keys[3], keys[4]);
        assert_eq!(initialize.program_id, ESPL_TOKEN_PROGRAM_ID);
        assert_eq!(
            initialize.data,
            ESplInstruction::InitializeEphemeralAta.to_vec()
        );
        assert_eq!(initialize.accounts.len(), 5);
        assert!(initialize.accounts[1].is_signer);

        let delegate = delegate_ephemeral_ata_instruction(
            keys[0], keys[1], keys[2], keys[3], keys[4], keys[5], keys[6], keys[7], keys[8],
        )
        .unwrap();
        let expected_args = DelegateArgs {
            validator: Some(keys[8].to_bytes().into()),
        }
        .encode()
        .unwrap();
        assert_eq!(delegate.program_id, ESPL_TOKEN_PROGRAM_ID);
        assert_eq!(
            delegate.data,
            ESplInstruction::DelegateEphemeralAta.with_data(&expected_args)
        );
        assert_eq!(delegate.accounts.len(), 8);
        assert!(delegate.accounts[0].is_signer);
    }
}
