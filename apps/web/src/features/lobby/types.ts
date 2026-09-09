import type { FlinchClient, TransactionSigner } from "@flinch/client";
import type { WebConfig } from "../../lib/config.ts";
import type { ActionRequest } from "../../lib/use-actions.ts";

export type LobbyProps = {
  client: FlinchClient;
  config: WebConfig;
  signer?: TransactionSigner;
  busy: boolean;
  open: (address: string) => void;
  run: (request: ActionRequest) => Promise<unknown>;
};
