import { VersionedTransaction } from "@solana/web3.js";
import type { Connection } from "@solana/web3.js";
import { journal } from "./evidence.ts";

export function captureSubmissionFailure(rpc: Connection, directory: string, record = (name: string, value: unknown) => journal(directory, name, value)) {
  const send = rpc.sendRawTransaction.bind(rpc);
  rpc.sendRawTransaction = async (bytes, options) => {
    try { return await send(bytes, options); } catch (error) {
      try {
      const transaction = VersionedTransaction.deserialize(new Uint8Array(bytes));
      const keys = transaction.message.staticAccountKeys;
      const addresses = keys.filter((_, index) => transaction.message.isAccountWritable(index));
      record("submission-failure", { endpoint: rpc.rpcEndpoint, error: String(error),
        logs: "transactionLogs" in Object(error) ? Object(error).transactionLogs : undefined,
        accounts: addresses.map(key => key.toBase58()), blockhash: transaction.message.recentBlockhash });
        const read = await rpc.getMultipleAccountsInfoAndContext(addresses, "confirmed");
        const simulation = await rpc.simulateTransaction(transaction, { commitment: "confirmed", sigVerify: true,
          accounts: { encoding: "base64", addresses: addresses.map(key => key.toBase58()) } });
        record("failure-replay", { endpoint: rpc.rpcEndpoint, read: { slot: read.context.slot,
          accounts: read.value.map((account, index) => ({ address: addresses[index].toBase58(), account: account && {
            owner: account.owner.toBase58(), lamports: account.lamports, dataBase64: account.data.toString("base64") } })) }, simulation });
      } catch (captureError) {
        try { record("failure-capture-error", { error: String(captureError) }); } catch {}
      }
      throw error;
    }
  };
}
