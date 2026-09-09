import { DelegationStatus, delegationRecordPdaFromDelegatedAccount, parseDelegationRecordAccount } from "@magicblock-labs/ephemeral-rollups-sdk";
import { ClientError, connection, endpoint } from "@flinch/client";
import type { PlacementResolver } from "@flinch/client";

export function localPlacement(baseUrl: string, erUrl: string): PlacementResolver {
  const base = connection(baseUrl, "localnet");
  const er = endpoint(erUrl, "localnet", true);
  return { resolve: async (control, validator, signal) => {
    signal?.throwIfAborted();
    const result = await base.getAccountInfoAndContext(delegationRecordPdaFromDelegatedAccount(control), "confirmed");
    const record = parseDelegationRecordAccount(result.value);
    if (record.status !== DelegationStatus.Delegated) throw new ClientError("placement_pending", "Waiting for local delegation");
    if (!record.validator.equals(validator)) throw new Error("Local validator differs from room");
    return { endpoint: er, validator, observedSlot: result.context.slot };
  } };
}
