import { result } from "./evidence.ts";
import { startStack } from "./bootstrap.ts";
import { prepareRoom } from "./room.ts";
import { claimAll, playBatch } from "./lifecycle.ts";

const stack = await startStack();
const expiry = process.argv.includes("--expiry");
console.log(`Local stack evidence: ${stack.directory}`);
try {
  const room = await prepareRoom(stack);
  await playBatch(room, [0], true);
  if (expiry) await playBatch(room, [1, 2], false, true);
  await playBatch(room, [1, 2], false, false, expiry ? 2 : 1);
  await claimAll(room);
  const outcome = { complete: true, environment: "local MagicBlock stack", syntheticLiquidity: true,
    controlInjected: false, handoffs: expiry ? 3 : 2, expiredBatches: expiry ? 1 : 0,
    claims: 4, ledger: room.ledger.toBase58() };
  result(stack.directory, outcome);
  console.log(JSON.stringify(outcome));
} catch (error) {
  result(stack.directory, { complete: false, environment: "local MagicBlock stack", error: String(error) });
  throw error;
} finally {
  await stack.stop();
}
