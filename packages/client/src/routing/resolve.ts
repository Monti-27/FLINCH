import { SYSVAR_CLOCK_PUBKEY } from "@solana/web3.js";
import { DELEGATION_PROGRAM_ID } from "@magicblock-labs/ephemeral-rollups-sdk";
import type { Connection } from "@solana/web3.js";
import { controlAddress } from "../addresses.ts";
import { createProgram, PROGRAM_ID } from "../program.ts";
import { clockTime } from "../accounts/read.ts";
import { decodeControl, matchesLedger } from "../accounts/decode.ts";
import { ClientError, check } from "../errors.ts";
import { isRecord, rpcRequest } from "./rpc.ts";
import type { BaseRoom } from "../model.ts";
import type { PlacementResolver } from "./router.ts";

export async function resolveRoom(base: BaseRoom, resolver: PlacementResolver, connect: (url: string) => Connection, signal?: AbortSignal,
  refreshBase?: (minSlot: number) => Promise<BaseRoom>, programId = PROGRAM_ID) {
  check(base.control.kind === "delegated", "Control is not delegated on base");
  const address = controlAddress(base.ledger.address, programId)[0];
  const placement = await resolver.resolve(address, base.ledger.validator, signal);
  check(placement.validator.equals(base.ledger.validator), "Placement validator differs");
  if ("delegationSlot" in placement && placement.delegationSlot > base.slot) throw new ClientError("placement_pending", "Base snapshot predates the delegation record");
  let observedBase = base;
  if ("observedSlot" in placement) {
    check(Number.isSafeInteger(placement.observedSlot) && placement.observedSlot >= 0 && refreshBase, "Observed placement requires a base refresh");
    observedBase = await refreshBase(Math.max(base.slot, placement.observedSlot));
    check(observedBase.slot >= placement.observedSlot && observedBase.ledger.address.equals(base.ledger.address), "Refreshed base snapshot is stale or belongs to another room");
    check(observedBase.ledger.validator.equals(placement.validator), "Refreshed validator differs from placement");
    if (observedBase.control.kind !== "delegated") throw new ClientError("placement_pending", "Control placement changed while resolving");
  }
  const er = connect(placement.endpoint);
  const [identity, result] = await Promise.all([
    rpcRequest(placement.endpoint, "getIdentity", [], signal),
    er.getMultipleAccountsInfoAndContext([address, SYSVAR_CLOCK_PUBKEY], "confirmed"),
  ]);
  check(isRecord(identity) && identity.identity === placement.validator.toBase58(), "ER identity differs from delegation");
  if (!result.value[0]) throw new ClientError("placement_pending", "Control has not propagated to the ER");
  if (result.value[0].owner.equals(DELEGATION_PROGRAM_ID)) throw new ClientError("placement_pending", "ER is observing delegated base state during a handoff");
  const control = decodeControl(createProgram(er, programId), base.ledger, result.value[0]);
  if (!matchesLedger(control, base.ledger) || !matchesLedger(control, observedBase.ledger)) throw new ClientError("placement_pending", "ER revision has not caught up with base");
  return { connection: er, placement, control, now: clockTime(result.value[1]), slot: result.context.slot };
}
