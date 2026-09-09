"use client";

import { CreateRoom } from "./create-room.tsx";
import { JoinRoom } from "./join-room.tsx";
import type { LobbyProps } from "./types.ts";
import { useUi } from "../../providers/ui-provider.tsx";
import { SegmentedControl } from "../../components/ui/segmented-control.tsx";
import { Link2, Plus } from "lucide-react";
import { motion } from "framer-motion";

const TIMING = { enter: 0.25, offset: 6 };

export function Lobby(props: LobbyProps) {
  const mode = useUi(state => state.lobbyMode);
  const setMode = useUi(state => state.setLobbyMode);
  const reduced = useUi(state => state.reducedMotion);
  return (
    <aside className="lobby-section" aria-label="Room entry" data-mode={mode}>
      <div className="entry-header"><SegmentedControl label="Room entry mode" className="entry-modes" appearance="tabs" value={mode} onChange={setMode}
        options={[{ value: "create", label: <><Plus size={15} aria-hidden />New round</> },
          { value: "join", label: <><Link2 size={15} aria-hidden />Room code</>, name: "Have a room code?" }]} /></div>
      <motion.div className="entry-view" key={mode} initial={reduced ? false : { opacity: 0, y: TIMING.offset }}
        animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : TIMING.enter, ease: [0.16, 1, 0.3, 1] }}>
        {mode === "create" ? <CreateRoom {...props} /> : <JoinRoom busy={props.busy} open={props.open} />}
      </motion.div>
    </aside>
  );
}
