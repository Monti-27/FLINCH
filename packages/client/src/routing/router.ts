import { PublicKey } from "@solana/web3.js";
import { DEVNET_PROGRAM_ID } from "../program.ts";
import { ClientError, check } from "../errors.ts";
import { endpoint } from "../network.ts";
import { isRecord, rpcRequest } from "./rpc.ts";
import type { RpcRequest } from "./rpc.ts";

export type Placement = Readonly<{ endpoint: string; validator: PublicKey } & ({ delegationSlot: number } | { observedSlot: number })>;
export interface PlacementResolver {
  resolve(control: PublicKey, validator: PublicKey, signal?: AbortSignal): Promise<Placement>;
}

export class DevnetRouter implements PlacementResolver {
  private readonly url: string;
  private readonly request: RpcRequest;
  private readonly programId: PublicKey;
  constructor(url = "https://devnet-router.magicblock.app/", request: RpcRequest = rpcRequest, programId = DEVNET_PROGRAM_ID) {
    this.url = endpoint(url, "devnet", true);
    this.request = request;
    this.programId = programId;
  }

  async resolve(control: PublicKey, validator: PublicKey, signal?: AbortSignal): Promise<Placement & { delegationSlot: number }> {
    const result = await this.request(this.url, "getDelegationStatus", [control.toBase58()], signal);
    check(isRecord(result) && typeof result.isDelegated === "boolean", "Invalid delegation response");
    if (!result.isDelegated) throw new ClientError("placement_pending", "Router has not observed delegation");
    const record = result.delegationRecord;
    check(isRecord(record) && typeof result.fqdn === "string", "Delegation metadata is missing");
    check(record.owner === this.programId.toBase58() && record.authority === validator.toBase58(), "Router owner or validator differs");
    check(typeof record.delegationSlot === "number" && Number.isSafeInteger(record.delegationSlot) && record.delegationSlot >= 0, "Invalid delegation slot");
    return { endpoint: endpoint(result.fqdn, "devnet", true), validator, delegationSlot: record.delegationSlot };
  }
}
