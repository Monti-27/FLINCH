import { PublicKey } from "@solana/web3.js";
import { PostgresOperationStore } from "./postgres-store.ts";

const room = process.argv[2];
if (process.argv.length !== 3 || !process.env.DATABASE_URL || new PublicKey(room).toBase58() !== room) {
  throw new Error("Pass one exact room address in the hosted keeper environment");
}
const store = new PostgresOperationStore(process.env.DATABASE_URL);
try { console.log(JSON.stringify({ room, history: await store.history(room) })); }
finally { await store.close(); }
