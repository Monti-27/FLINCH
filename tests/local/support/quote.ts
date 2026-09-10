import type { AccountInfo, Connection, PublicKey } from "@solana/web3.js";
import type { Room } from "./room.ts";
import { raydiumIdl } from "./runtime.ts";
import { encodeFixture } from "./pool.ts";
import { poolCoder } from "../../../packages/client/src/accounts/raydium.ts";

export function poolConnection(room: Room) {
  const info = (key: PublicKey): AccountInfo<Buffer> | null => {
    const account = room.svm.getAccount(key);
    return account && { ...account, data: Buffer.from(account.data) };
  };
  return { getAccountInfo: async (key: PublicKey) => info(key),
    getMultipleAccountsInfoAndContext: async (keys: PublicKey[]) => ({ context: { slot: 50 }, value: keys.map(info) }) } as unknown as Connection;
}

export function patchPool(room: Room, address: PublicKey, name: string, update: (raw: Record<string, any>) => void) {
  const account = room.svm.getAccount(address)!;
  const raw = poolCoder.decode(name, Buffer.from(account.data));
  update(raw);
  room.svm.setAccount(address, { ...account, data: encodeFixture(raydiumIdl, name, raw) });
}
