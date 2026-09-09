import type { PublicKey } from "@solana/web3.js";
import { connection, endpoint, verifyNetwork } from "./network.ts";
import type { Network } from "./network.ts";
import { createProgram, programIdFor } from "./program.ts";
import { readBaseRoom } from "./accounts/read.ts";
import { readPoolAccounts } from "./accounts/pool.ts";
import { custodyInstructions } from "./instructions/custody.ts";
import { controlInstructions } from "./instructions/control.ts";
import { executeInstruction } from "./instructions/settlement.ts";
import { resolveRoom } from "./routing/resolve.ts";
import { DevnetRouter } from "./routing/router.ts";
import type { PlacementResolver } from "./routing/router.ts";
import type { BaseRoom } from "./model.ts";
import { controlAddress } from "./addresses.ts";
import { findReturnProof } from "./commitment.ts";
import { transactionStatus } from "./transactions.ts";
import { check, ClientError } from "./errors.ts";
import { readQuotePool } from "./quotes/read.ts";
import { quoteSell } from "./quotes/sell.ts";
import { readReceipts } from "./accounts/receipts.ts";

export type ClientConfig = Readonly<{ network: Network; baseUrl: string; expectedGenesis: string }>;

export class FlinchClient {
  readonly base;
  readonly instructions;
  readonly programId;
  private readonly program;
  private networkVerification?: Promise<void>;
  readonly config: ClientConfig;
  readonly resolver: PlacementResolver;

  constructor(config: ClientConfig, resolver?: PlacementResolver) {
    check(config.network !== "localnet" || resolver !== undefined, "Localnet requires an explicit placement resolver");
    this.config = Object.freeze({ ...config });
    this.programId = programIdFor(config.network);
    this.resolver = resolver ?? new DevnetRouter(undefined, undefined, this.programId);
    this.base = connection(config.baseUrl, config.network);
    this.program = createProgram(this.base, this.programId);
    this.instructions = { ...custodyInstructions(this.program), ...controlInstructions(this.program) };
    void this.ready().catch(() => undefined);
  }

  private ready(): Promise<void> {
    this.networkVerification ??= verifyNetwork(this.base, this.config.network, this.config.expectedGenesis).catch(error => {
      if (!(error instanceof ClientError)) this.networkVerification = undefined;
      throw error;
    });
    return this.networkVerification;
  }

  async readRoom(ledger: PublicKey, minContextSlot?: number) {
    await this.ready();
    return readBaseRoom(this.base, ledger, minContextSlot, this.programId);
  }

  async resolve(room: BaseRoom, signal?: AbortSignal) {
    await this.ready();
    return resolveRoom(room, this.resolver, url => connection(endpoint(url, this.config.network, true), this.config.network), signal,
      minSlot => this.readRoom(room.ledger.address, minSlot), this.programId);
  }

  async execute(ledger: PublicKey, revision: bigint, payer: PublicKey, pool: PublicKey) {
    await this.ready();
    return executeInstruction(this.program, ledger, revision, payer, await readPoolAccounts(this.base, pool));
  }

  async quote(ledger: PublicKey, seat: number, slippageBps = 100, signal?: AbortSignal) {
    const room = await this.readRoom(ledger);
    const [pool, er] = await Promise.all([readQuotePool(this.base, room.ledger.pool, room.slot), this.resolve(room, signal)]);
    return quoteSell(pool, er.control, seat, er.now, slippageBps);
  }

  async returnProof(room: BaseRoom) {
    await this.ready();
    return findReturnProof(this.base, controlAddress(room.ledger.address, this.programId)[0], room.slot, this.programId);
  }

  async receipts(room: BaseRoom) {
    await this.ready();
    return readReceipts(this.base, room, this.programId);
  }

  async status(runtime: "base" | "er", url: string, signature: string) {
    await this.ready();
    const validated = endpoint(url, this.config.network, runtime === "er");
    check(runtime !== "base" || validated === this.base.rpcEndpoint, "Base journal endpoint differs from configuration");
    return transactionStatus(runtime === "base" ? this.base : connection(validated, this.config.network), signature);
  }
}
