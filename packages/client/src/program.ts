import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import type { Connection } from "@solana/web3.js";
import idl from "../generated/idl.json" with { type: "json" };
import devnetIdl from "../generated/devnet.json" with { type: "json" };
import type { FlinchV2 } from "../generated/types.ts";

export const PROGRAM_ID = new PublicKey(idl.address);
export const DEVNET_PROGRAM_ID = new PublicKey("8mGLM6MoGgJBfJXAESN5C5fmKXCwnfinDGXX8drPFEie");
export const programIdFor = (network: "devnet" | "localnet") => network === "devnet" ? DEVNET_PROGRAM_ID : PROGRAM_ID;
export const USDC_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
export const RAYDIUM_ID = new PublicKey("DRaycpLY18LhpbydsBWbVJtxpNv9oXPgjRSfpF2bWpYb");
export const createProgram = (connection: Connection, programId = PROGRAM_ID) => {
  if (!programId.equals(PROGRAM_ID) && !programId.equals(DEVNET_PROGRAM_ID)) throw new Error("Unsupported FLINCH program");
  return new anchor.Program<FlinchV2>(programId.equals(DEVNET_PROGRAM_ID) ? devnetIdl : idl, { connection });
};
export const integer = (value: bigint) => new anchor.BN(value.toString());
export type FlinchProgram = ReturnType<typeof createProgram>;
export type WireAccounts = anchor.IdlAccounts<FlinchV2>;
