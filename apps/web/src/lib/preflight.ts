import type { Connection, VersionedTransaction } from "@solana/web3.js";

export async function simulateBeforeSigning(rpc: Connection, transaction: VersionedTransaction) {
  const result = await rpc.simulateTransaction(transaction, { commitment: "confirmed", sigVerify: false });
  if (result.value.err) throw new Error(`Transaction preview was rejected. Nothing was signed or submitted. ${JSON.stringify(result.value.err)}`);
}
