"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { ledgerAddress, readQuotePool, verifyNetwork } from "@flinch/client";
import { useUi } from "../../providers/ui-provider.tsx";
import type { LobbyProps } from "./types.ts";
import { Button } from "../../components/ui/button.tsx";
import { LoaderCircle } from "lucide-react";
import { StakeControl } from "./stake-control.tsx";
import { validStake } from "./stake-value.ts";
import { notify, notifyActionError } from "../../lib/notify-action.ts";
import { RoundTerms } from "./round-terms.tsx";

export function CreateRoom({ client, config, signer, busy, open, run }: LobbyProps) {
  const stake = useUi(state => state.stake);
  const setStake = useUi(state => state.setStake);
  const [invalid, setInvalid] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const unavailable = !config.transactions || !config.pool || !config.validator;

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      if (!signer || !config.pool || !config.validator || !config.transactions) {
        throw new Error("Room creation needs an enabled deployment and a connected wallet.");
      }
      const amount = validStake(stake);
      if (amount === null) {
        setInvalid(true);
        input.current?.focus();
        notify({ tone: "warning", title: "Check your stake", description: "Enter between 0.001 and 0.01 SOL, with up to 9 decimal places." });
        return;
      }
      setInvalid(false);
      await verifyNetwork(client.base, config.network, config.expectedGenesis);
      await readQuotePool(client.base, config.pool);
      const bytes = crypto.getRandomValues(new Uint8Array(8));
      const nonce = new DataView(bytes.buffer).getBigUint64(0, true);
      const room = ledgerAddress(signer.publicKey, nonce, client.programId)[0];
      const result = await run({
        label: "Create room", room, signer,
        instructions: [await client.instructions.initialize(signer.publicKey, nonce, amount, config.validator, config.pool)],
      });
      if (result) open(room.toBase58());
    } catch (value) {
      notifyActionError(value, { action: "Create room" });
    }
  };

  return (
    <form className="create-room" onSubmit={create} aria-busy={busy}>
      <h2 className="sr-only">Create a room</h2>
      <StakeControl ref={input} value={stake} onChange={value => { setStake(value); setInvalid(false); }} invalid={invalid} disabled={busy} />
      <RoundTerms />
      <div className="entry-footer">
        <p id="stake-help" className="field-help">Your stake is deposited when you join.</p>
        <Button size="lg" className="create-action" type="submit" isLoading={busy} disabled={busy || !signer || unavailable}>
          {busy && <LoaderCircle className="entry-spinner" size={16} aria-hidden />}<span>{busy ? "Creating room…" : "Create room"}</span>
        </Button>
      </div>
      <p className="availability">{unavailable ? "Preview only · onchain play is not enabled."
        : !signer ? "Connect your wallet to create a room." : "Invite three players after creating your room."}</p>
    </form>
  );
}
