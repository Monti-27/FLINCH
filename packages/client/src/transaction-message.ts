import { ComputeBudgetProgram, VersionedMessage } from "@solana/web3.js";
import { ClientError } from "./errors.ts";

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const accounts = (message: VersionedMessage) => message.staticAccountKeys.map((key, index) => ({
  key: key.toBase58(), signer: message.isAccountSigner(index), writable: message.isAccountWritable(index),
}));
const instructions = (message: VersionedMessage, budget: boolean) => message.compiledInstructions
  .filter(ix => message.staticAccountKeys[ix.programIdIndex]?.equals(ComputeBudgetProgram.programId) === budget)
  .map(ix => ({ program: message.staticAccountKeys[ix.programIdIndex]?.toBase58(), data: Array.from(ix.data),
    accounts: ix.accountKeyIndexes.map(index => message.staticAccountKeys[index]?.toBase58() ?? `lookup:${index}`) }));

function differences(expected: VersionedMessage, actual: VersionedMessage): string[] {
  const changed: string[] = [];
  if (expected.version !== actual.version) changed.push("message version");
  if (expected.recentBlockhash !== actual.recentBlockhash) changed.push("blockhash");
  if (!expected.staticAccountKeys[0]?.equals(actual.staticAccountKeys[0])) changed.push("fee payer");
  if (!same(accounts(expected), accounts(actual))) changed.push("accounts or permissions");
  if (!same(expected.addressTableLookups, actual.addressTableLookups)) changed.push("address lookups");
  if (!same(instructions(expected, true), instructions(actual, true))) changed.push("compute budget");
  if (!same(instructions(expected, false), instructions(actual, false))) changed.push("instructions");
  return changed.length ? changed : ["message encoding"];
}

export function assertMessageUnchanged(expected: Uint8Array, actual: VersionedMessage, source: "Signer" | "Transaction preview") {
  const bytes = actual.serialize();
  if (bytes.length === expected.length && bytes.every((value, index) => value === expected[index])) return;
  const changed = differences(VersionedMessage.deserialize(expected), actual);
  throw new ClientError("invalid_signature", `${source} changed the transaction message (${changed.join(", ")}). Nothing was submitted.`);
}
