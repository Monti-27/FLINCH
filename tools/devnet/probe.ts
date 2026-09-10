import { readFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { PublicKey } from "@solana/web3.js";
import { DELEGATION_PROGRAM_ID } from "@magicblock-labs/ephemeral-rollups-sdk";
import { connection, verifyNetwork, readQuotePool, quoteExactInput, RAYDIUM_ID, endpoint } from "../../packages/client/src/index.ts";
import { rpcRequest, isRecord } from "../../packages/client/src/routing/rpc.ts";
import { DEVNET, devnetEndpoint } from "./settings.ts";
import { privateDirectory, readKey, writePrivate } from "./private-files.ts";
import { deployedProgram, hash, matchesBinary } from "./program-data.ts";
import { fundingBudget } from "./budget.ts";

const SESSION_PROGRAM = new PublicKey("KeyspM2ssCJbqUhQ4k7sveSiY4WjnYsrXkC8oDbwde5");
const publicProgram = (value: Awaited<ReturnType<typeof deployedProgram>>) => value && { ...value, bytes: undefined };
const stringify = (value: unknown) => JSON.stringify(value, (_, item) => typeof item === "bigint" ? item.toString() : item, 2);

export async function probeDevnet(directory: string) {
  const location = await privateDirectory(directory);
  const programKey = await readKey(resolve(location, "build/flinch_v2-keypair.json"), DEVNET.program);
  const deployer = await readKey(resolve(location, "deployer.json"));
  const binary = await readFile(resolve(location, "build/flinch_v2.so"));
  const idl = JSON.parse(await readFile(resolve(location, "build/flinch_v2.json"), "utf8"));
  if (idl.address !== programKey.publicKey.toBase58() || binary.subarray(0, 4).toString("hex") !== "7f454c46") throw new Error("Devnet build identity differs");
  const clientIdl = JSON.parse(await readFile(resolve("packages/client/generated/devnet.json"), "utf8"));
  if (JSON.stringify(idl) !== JSON.stringify(clientIdl)) throw new Error("Devnet ABI differs from the reviewed client");
  const base = connection(devnetEndpoint(), "devnet");
  await verifyNetwork(base, "devnet", DEVNET.genesis);
  const [flinch, raydium, session, delegation, pool] = await Promise.all([
    deployedProgram(base, DEVNET.program), deployedProgram(base, RAYDIUM_ID), deployedProgram(base, SESSION_PROGRAM),
    base.getAccountInfo(DELEGATION_PROGRAM_ID, "confirmed"), readQuotePool(base, DEVNET.pool),
  ]);
  if (!raydium || raydium.hash !== DEVNET.raydiumHash) throw new Error("Raydium bytecode changed; review before deploying");
  if (!session || !delegation?.executable) throw new Error("Required devnet programs are unavailable");
  if (flinch && (!matchesBinary(flinch.bytes, binary) || flinch.authority !== deployer.publicKey.toBase58())) throw new Error("Existing FLINCH deployment differs");
  const identity = await rpcRequest(DEVNET.routerUrl, "getIdentity", []);
  if (!isRecord(identity) || identity.identity !== DEVNET.validator.toBase58() || typeof identity.fqdn !== "string") throw new Error("Router selection differs from the prepared validator");
  const erUrl = endpoint(identity.fqdn, "devnet", true);
  const actualIdentity = await rpcRequest(erUrl, "getIdentity", []);
  if (!isRecord(actualIdentity) || actualIdentity.identity !== identity.identity) throw new Error("ER identity mismatch");
  const undelegated = await rpcRequest(DEVNET.routerUrl, "getDelegationStatus", [DEVNET.program.toBase58()]);
  if (!isRecord(undelegated) || undelegated.isDelegated !== false) throw new Error("Unexpected program delegation status");
  const serviceResponse = await fetch("https://status.magicblock.app/api/services", { signal: AbortSignal.timeout(5000), redirect: "error" });
  if (!serviceResponse.ok) throw new Error("Service status unavailable");
  const services = await serviceResponse.json();
  const status = services.environments?.devnet?.regions?.asia?.servers?.[new URL(erUrl).hostname]?.live_status;
  if (status?.er !== true || status?.rpc_router !== true) throw new Error("Selected devnet service is not operational");
  const maxBatch = quoteExactInput(pool, 40_000_000n);
  if (pool.inputReserve < 4_000_000_000n || maxBatch.output < 4n) throw new Error("Pool liquidity is too small for the prepared demo");
  const rents = await Promise.all([36, binary.length + 45, binary.length + 37].map(size => base.getMinimumBalanceForRentExemption(size, "confirmed")));
  if (rents.some(value => !Number.isSafeInteger(value) || value < 0)) throw new Error("Invalid rent response");
  const budget = fundingBudget(binary.length, { program: BigInt(rents[0]), data: BigInt(rents[1]), buffer: BigInt(rents[2]) });
  const balance = await base.getBalance(deployer.publicKey, "confirmed");
  if (!Number.isSafeInteger(balance) || balance < 0) throw new Error("Invalid balance response");
  return { checkedAt: new Date().toISOString(), network: "devnet", genesis: DEVNET.genesis, baseUrl: base.rpcEndpoint,
    program: DEVNET.program.toBase58(), deployer: deployer.publicKey.toBase58(), balance: BigInt(balance), binary: { bytes: binary.length, sha256: hash(binary) },
    deployed: !!flinch, flinch: publicProgram(flinch), raydium: publicProgram(raydium), session: publicProgram(session),
    router: { validator: identity.identity, endpoint: erUrl, services: status, liveRoomPlacementVerified: false },
    pool: { address: DEVNET.pool.toBase58(), inputReserve: pool.inputReserve, outputReserve: pool.outputReserve, tradeFeeRate: pool.tradeFeeRate,
      quoteForOneMilliSol: quoteExactInput(pool, 1_000_000n), maximumBatchQuote: maxBatch, slot: pool.slot }, budget,
    preFundingChecksPassed: true, endToEndVerified: false, remaining: ["deployment", "hosted room routing", "session propagation/revocation", "real swaps and claims", "ten sequential rounds", "real wallet extensions"],
    oracle: "Not used for execution. Coinbase is display-only; a live MagicBlock price-feed check remains separate." };
}

if (process.argv[1] === import.meta.filename) {
  try {
    if (process.argv.length !== 4 || process.argv[2] !== "--directory") throw new Error("Invalid arguments");
    const result = await probeDevnet(process.argv[3]);
    const evidence = resolve("artifacts/runs", `devnet-probe-${Date.now()}`);
    await mkdir(evidence, { mode: 0o700 });
    await writePrivate(resolve(evidence, "result.json"), stringify(result));
    console.log(stringify(result));
    console.log(`Evidence: ${evidence}`);
  } catch (error) { console.error(error instanceof Error && !error.message.includes("http") ? error.message : "Devnet preflight failed; no transaction was submitted"); process.exitCode = 1; }
}
