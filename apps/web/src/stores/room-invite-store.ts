import { createStore } from "zustand/vanilla";
import { roomLink } from "../lib/room-link.ts";

type InviteState = {
  status: "idle" | "copying" | "copied" | "manual";
  link: string;
  reset: () => void;
  copy: (href: string, write: (link: string) => Promise<void>) => Promise<void>;
};

export function createRoomInviteStore(address: string) {
  let generation = 0;
  return createStore<InviteState>()((set, get) => ({
    status: "idle", link: "",
    reset: () => { generation++; set({ status: "idle", link: "" }); },
    copy: async (href, write) => {
      if (get().status === "copying") return;
      const link = roomLink(href, address);
      const request = ++generation;
      set({ status: "copying", link });
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([write(link), new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("Clipboard did not respond")), 5000);
        })]);
        if (request === generation) set({ status: "copied" });
      } catch {
        if (request === generation) set({ status: "manual" });
      } finally { clearTimeout(timer); }
    },
  }));
}
