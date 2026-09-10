import { PublicKey } from "@solana/web3.js";
import { DEVNET_GENESIS, DEVNET_PROGRAM_ID, endpoint } from "../../packages/client/src/index.ts";

export const DEVNET = Object.freeze({
  genesis: DEVNET_GENESIS,
  program: DEVNET_PROGRAM_ID,
  baseUrl: "https://rpc.magicblock.app/devnet",
  routerUrl: "https://devnet-router.magicblock.app/",
  pool: new PublicKey("GoZmddUBTdiyRoGZSfxwX8p5ZNoVhDo42YN996JdDwoi"),
  validator: new PublicKey("MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57"),
  raydiumHash: "c5ba03746795b128cdfb38af41bbef130dc6d38cff532e03b208c938a8787a82",
});

export const devnetEndpoint = () => endpoint(process.env.FLINCH_DEVNET_RPC ?? DEVNET.baseUrl, "devnet");
