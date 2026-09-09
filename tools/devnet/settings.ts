import { PublicKey } from "@solana/web3.js";
import { DEVNET_GENESIS, DEVNET_PROGRAM_ID, endpoint } from "../../packages/client/src/index.ts";

export const DEVNET = Object.freeze({
  genesis: DEVNET_GENESIS,
  program: DEVNET_PROGRAM_ID,
  baseUrl: "https://rpc.magicblock.app/devnet",
  routerUrl: "https://devnet-router.magicblock.app/",
  pool: new PublicKey("GoZmddUBTdiyRoGZSfxwX8p5ZNoVhDo42YN996JdDwoi"),
  validator: new PublicKey("MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57"),
  raydiumHash: "8d479aa24b5472687ab540a6c9e4581a36095c03b3c1575b515b38d5bfced0f1",
  sessionHash: "bc2209916d7a5e39738359a9891e00de89af4c254d8f288c5ec9752e64fee449",
  delegationHash: "e940763c05d5151ac3f6fa4b0ee4c882361eff653fa25e19bc6087e908d1b4fd",
});

export const devnetEndpoint = () => endpoint(process.env.FLINCH_DEVNET_RPC ?? DEVNET.baseUrl, "devnet");
