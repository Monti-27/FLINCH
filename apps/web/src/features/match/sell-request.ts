import { connection, prepareQuotedSell, submitQuotedSell } from "@flinch/client";
import type { FlinchClient, PreparedSell, SellQuote, TransactionSigner } from "@flinch/client";
import type { PublicKey } from "@solana/web3.js";
import type { ActionRequest } from "../../lib/use-actions.ts";

export function sellRequest(client: FlinchClient, quote: SellQuote, signer: TransactionSigner, sessionToken?: PublicKey,
  onQuote?: (quote: SellQuote) => void): ActionRequest {
  let sell: PreparedSell | undefined;
  return {
    label: "Queue SELL", room: quote.ledger, runtime: "er", signer,
    prepare: async () => {
      sell = await prepareQuotedSell(client, quote, signer, { sessionToken, messageVersion: "legacy", refreshQuote: true, onQuote });
      return { prepared: sell.prepared, rpc: connection(sell.endpoint, client.config.network) };
    },
    submit: prepared => {
      if (!sell || prepared !== sell.prepared) throw new Error("SELL does not match the prepared transaction");
      return submitQuotedSell(client, sell);
    },
  };
}
