import { DelegationStatus, delegationRecordPdaFromDelegatedAccount, parseDelegationRecordAccount } from "@magicblock-labs/ephemeral-rollups-sdk";
import type { Connection, PublicKey } from "@solana/web3.js";
import { ClientError, check } from "../errors.ts";
import { endpoint } from "../network.ts";
import type { PlacementResolver } from "./router.ts";

export class LocalPlacementResolver implements PlacementResolver {
  private readonly base: Pick<Connection, "getAccountInfoAndContext">;
  private readonly url: string;

  constructor(base: Pick<Connection, "getAccountInfoAndContext">, erUrl: string) {
    this.base = base;
    this.url = endpoint(erUrl, "localnet");
  }

  async resolve(control: PublicKey, validator: PublicKey, signal?: AbortSignal) {
    signal?.throwIfAborted();
    const response = await this.base.getAccountInfoAndContext(delegationRecordPdaFromDelegatedAccount(control), "confirmed");
    signal?.throwIfAborted();
    const record = parseDelegationRecordAccount(response.value);
    if (record.status !== DelegationStatus.Delegated) throw new ClientError("placement_pending", "Local delegation not yet visible");
    check(record.validator.equals(validator), "Local delegation validator differs");
    return { endpoint: this.url, validator, observedSlot: response.context.slot };
  }
}
