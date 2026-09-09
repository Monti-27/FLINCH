"use client";

import { useRef, useState } from "react";
import { readRoomLink } from "../../lib/room-link.ts";
import { useUi } from "../../providers/ui-provider.tsx";
import { Button } from "../../components/ui/button.tsx";
import { notify } from "../../lib/notify-action.ts";
import { Link2 } from "lucide-react";

export function JoinRoom({ busy, open }: { busy: boolean; open: (address: string) => void }) {
  const address = useUi(state => state.invite);
  const setAddress = useUi(state => state.setInvite);
  const [invalid, setInvalid] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  return (
    <form className="join-room" onSubmit={event => {
      event.preventDefault();
      try {
        const room = readRoomLink(address, window.location.origin);
        setInvalid(false);
        open(room);
      } catch {
        setInvalid(true);
        notify({ tone: "warning", title: "Check the room link", description: "Enter a valid room address or an invite link from this site." });
        input.current?.focus();
      }
    }}>
      <div className="invite-ticket">
        <span className="invite-symbol" aria-hidden><Link2 size={24} /></span>
        <div className="form-heading"><h2>Find your round</h2><p>Have an invite? Your seat starts here.</p></div>
        <label htmlFor="room-address">Room address or invite link</label>
        <div className="invite-input">
          <input ref={input} id="room-address" name="room" type="text" autoComplete="off" spellCheck={false}
            placeholder="Paste a link or room address" value={address} onChange={event => { setAddress(event.target.value); setInvalid(false); }} maxLength={2048}
            aria-invalid={invalid} aria-describedby="room-help" required disabled={busy} />
        </div>
      </div>
      <div className="entry-footer"><p id="room-help" className="field-help">Preview the room before you join.<br />Everyone enters with the same SOL stake.</p>
        <Button size="lg" className="create-action" type="submit" disabled={busy}>Open room</Button>
      </div>
      <p className="availability">Opening a room does not deposit any tokens.</p>
    </form>
  );
}
