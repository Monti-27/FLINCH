import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { startStack } from "../../tests/stack/bootstrap.ts";
import { localClient, sendClient } from "../../tests/stack/client.ts";
import { requireFreePorts } from "../../tests/stack/process.ts";
import { LocalFunding } from "./funding.ts";
import { LocalRooms } from "./rooms.ts";
import { LOCAL_WEB_PORT, LOCAL_WEB_URL, startLocalWeb } from "./web.ts";
import { LocalLifecycle } from "./lifecycle.ts";

export async function startSandbox() {
  await requireFreePorts([LOCAL_WEB_PORT]);
  const stack = await startStack();
  let secrets: string | undefined;
  let web: Awaited<ReturnType<typeof startLocalWeb>> | undefined;
  let rooms: LocalRooms | undefined;
  const lifecycle = new LocalLifecycle({ rooms: () => rooms?.stop(), web: () => web?.stop(), stack: () => stack.stop(),
    keys: async () => { if (secrets) { await rm(secrets, { recursive: true, force: true }); secrets = undefined; } } });
  lifecycle.watch("stack", stack.finished);
  const stop = () => lifecycle.stop();
  try {
    secrets = await mkdtemp(join(tmpdir(), "flinch-local-"));
    const payer = Keypair.generate();
    await writeFile(join(secrets, "payer.json"), JSON.stringify([...payer.secretKey]), { mode: 0o600 });
    await sendClient(stack, stack.base, [SystemProgram.transfer({ fromPubkey: stack.host.publicKey, toPubkey: payer.publicKey, lamports: 500_000_000n })],
      [stack.host], "fund local sandbox keeper");
    const client = await localClient(stack);
    const genesis = client.config.expectedGenesis;
    const validator = new PublicKey((await stack.er.getClosestValidator()).identity);
    web = await startLocalWeb(stack, genesis, validator.toBase58());
    lifecycle.watch("web", web.finished);
    lifecycle.check();
    rooms = new LocalRooms(stack, client, secrets, payer.publicKey, validator);
    return { stack, client, rooms, funding: new LocalFunding(stack, genesis), stop, failure: lifecycle.failure, check: () => lifecycle.check(),
      info: { url: LOCAL_WEB_URL, network: "localnet", genesis, baseRpc: stack.base.rpcEndpoint, erRpc: stack.er.rpcEndpoint,
        pool: stack.pool.pool.toBase58(), validator: validator.toBase58(), keeperPayer: payer.publicKey.toBase58(),
        evidence: stack.directory, processes: { stack: stack.child.pid, web: web.child.pid },
        syntheticLiquidity: true, durableAcrossSandboxRestarts: false } };
  } catch (error) { await stop(); throw error; }
}
