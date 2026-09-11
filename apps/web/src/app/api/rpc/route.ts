import { rpcGateway } from "../../../lib/rpc/gateway.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = rpcGateway(() => process.env.NEXT_PUBLIC_FLINCH_NETWORK === "devnet" ? {
  key: process.env.FLINCH_HELIUS_API_KEY ?? "",
  origin: process.env.FLINCH_RPC_ORIGIN ?? "",
  pool: process.env.NEXT_PUBLIC_FLINCH_POOL ?? "",
  validator: process.env.NEXT_PUBLIC_FLINCH_VALIDATOR ?? "",
} : undefined);
