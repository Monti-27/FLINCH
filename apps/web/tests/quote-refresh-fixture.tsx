import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, VersionedTransaction } from "@solana/web3.js";
import { DEVNET_GENESIS, quoteSell } from "@flinch/client";
import type { BaseRoom, Control, FlinchClient, TransactionSigner } from "@flinch/client";
import { controlInstructions } from "../../../packages/client/src/instructions/control.ts";
import { createProgram } from "../../../packages/client/src/program.ts";
import { ticketRoom } from "./room-ticket-data.ts";
import { Sell } from "../src/features/match/sell.tsx";
import { useActions } from "../src/lib/use-actions.ts";
import { NotificationToaster } from "../src/components/ui/notification-toaster.tsx";
import "../src/styles/palette.css";
import "../src/styles/tokens.css";
import "../src/styles/base.css";
import "../src/styles/controls.css";
import "../src/styles/game.css";
import "../src/styles/notifications.css";
import "@fontsource-variable/manrope";
import "@fontsource-variable/space-grotesk";
import "./room-tickets-fixture.css";

const key = Keypair.generate();
const initial = ticketRoom("sell");
const room: BaseRoom = { ...initial, ledger: { ...initial.ledger,
  economics: { ...initial.ledger.economics!, holdings: [4_000_000n, 4_000_000n, 4_000_000n, 4_000_000n] },
  wallets: [key.publicKey, initial.ledger.wallets[1], initial.ledger.wallets[2], initial.ledger.wallets[3]] } };
let live: Control = { ...room.ledger.economics!, address: key.publicKey, ledger: room.ledger.address, validator: room.ledger.validator,
  wallets: room.ledger.wallets, sessionSigners: room.ledger.sessionSigners, phase: "live", sellers: 0, cohortIndex: 0,
  attempts: [0, 0, 0, 0], nonces: [0n, 0n, 0n, 0n], minimumOutputs: [0n, 0n, 0n, 0n] };
const started = Date.now();
const now = () => 100n + BigInt(Math.floor((Date.now() - started) / 1000));
const state = { reads: 0, prompts: 0, sends: 0, fail: false, available: true, reserve: 20_000_000_000n,
  release: undefined as undefined | ((reject: boolean) => void) };
Object.assign(window, { quoteTest: state });
const rpc = new Connection("https://devnet-as.magicblock.app/");
rpc.getLatestBlockhash = async () => ({ blockhash: key.publicKey.toBase58(), lastValidBlockHeight: 999 });
rpc.sendRawTransaction = async bytes => {
  state.sends++;
  live = { ...live, sellers: 1 };
  return anchor.utils.bytes.bs58.encode(VersionedTransaction.deserialize(new Uint8Array(bytes)).signatures[0]);
};
const client = { config: { expectedGenesis: DEVNET_GENESIS, network: "devnet" },
  base: { getGenesisHash: async () => DEVNET_GENESIS }, readRoom: async () => room,
  resolve: async () => ({ connection: rpc, control: live, now: now() }),
  status: async () => ({ kind: "confirmed", slot: 50 }), instructions: controlInstructions(createProgram(rpc)),
  quote: async () => {
    state.reads++;
    await new Promise(resolve => setTimeout(resolve, 100));
    if (state.fail) throw new Error("Test RPC unavailable");
    return quoteSell({ pool: room.ledger.pool, slot: 50, chainTime: now(), receivedAtMs: Date.now(),
      inputReserve: 100_000_000_000n, outputReserve: state.reserve, tradeFeeRate: 2500n,
      creatorFeeRate: 0n, fundFeeRate: 0n, protocolFeeRate: 0n, creatorFeeOnInput: true }, live, 0, now());
  } } as unknown as FlinchClient;
const signer: TransactionSigner = { publicKey: key.publicKey, sign: async tx => {
  state.prompts++;
  await new Promise<void>((resolve, reject) => { state.release = cancelled => {
    state.release = undefined;
    if (cancelled) reject(Object.assign(new Error("User rejected the request"), { code: 4001 }));
    else resolve();
  }; });
  tx.sign([key]);
  return tx;
} };

function Fixture() {
  const [time, setTime] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setTime(Date.now()), 100); return () => clearInterval(timer); }, []);
  const actions = useActions(client, key.publicKey.toBase58(), true);
  return <main className="ticket-fixture">
    <h1>Automatic quote checks</h1><p>Isolated test data and signer. No network transactions.</p>
    <div className="room-controls" style={{ maxWidth: 420 }}>
      <Sell client={client} room={room} control={state.available ? live : undefined} controlNow={now()} seat={0}
        wallet={signer} busy={actions.busy} enabled wallTime={time} run={actions.run} />
    </div><NotificationToaster />
  </main>;
}

createRoot(document.getElementById("root")!).render(<Fixture />);
