import { createStore } from "zustand/vanilla";
import { nextPlayerRailMode } from "./player-rail-state.ts";
import type { PlayerRailEvent, PlayerRailMode } from "./player-rail-state.ts";
import type { ChartInterval, ChartStyle } from "../features/market/chart-options.ts";

export type NavigationPanel = "game" | "protocol" | "rules";

export type UiState = {
  room: string;
  online: boolean;
  stake: string;
  invite: string;
  lobbyMode: "create" | "join";
  setLobbyMode: (mode: "create" | "join") => void;
  interval: ChartInterval;
  chartStyle: ChartStyle;
  helpOpen: boolean;
  reducedMotion: boolean;
  ambientMotionPaused: boolean;
  setAmbientMotionPaused: (paused: boolean) => void;
  compactPlayers: boolean;
  navigationPanel: NavigationPanel | null;
  mobileNavigation: boolean;
  setNavigationPanel: (panel: NavigationPanel | null) => void;
  openNavigationRules: () => void;
  setMobileNavigation: (open: boolean) => void;
  closeNavigation: () => void;
  setCompactPlayers: (compact: boolean) => void;
  setReducedMotion: (reduced: boolean) => void;
  playerRail: PlayerRailMode;
  dispatchPlayerRail: (event: PlayerRailEvent) => void;
  setRoom: (room: string) => void;
  setOnline: (online: boolean) => void;
  setStake: (stake: string | ((current: string) => string)) => void;
  setInvite: (invite: string) => void;
  setInterval: (interval: ChartInterval) => void;
  setChartStyle: (style: ChartStyle) => void;
  setHelpOpen: (open: boolean) => void;
};

export function createUiStore() {
  return createStore<UiState>()(set => ({
    room: "", online: true, stake: "0.001", invite: "", interval: 60, chartStyle: "candles", helpOpen: false,
    lobbyMode: "create",
    setLobbyMode: lobbyMode => set({ lobbyMode }),
    playerRail: "closed",
    reducedMotion: true,
    ambientMotionPaused: false,
    setAmbientMotionPaused: ambientMotionPaused => set({ ambientMotionPaused }),
    compactPlayers: true,
    navigationPanel: null,
    mobileNavigation: false,
    setNavigationPanel: navigationPanel => set({ navigationPanel }),
    openNavigationRules: () => set(state => ({ navigationPanel: "rules", mobileNavigation: state.compactPlayers })),
    setMobileNavigation: mobileNavigation => set({ mobileNavigation, navigationPanel: null }),
    closeNavigation: () => set({ navigationPanel: null, mobileNavigation: false }),
    setCompactPlayers: compactPlayers => set({ compactPlayers, playerRail: "closed", navigationPanel: null, mobileNavigation: false }),
    setReducedMotion: reducedMotion => set({ reducedMotion }),
    dispatchPlayerRail: event => set({ playerRail: nextPlayerRailMode(event) }),
    setRoom: room => set(state => ({ room, playerRail: state.room === room ? state.playerRail : "closed", navigationPanel: null, mobileNavigation: false })), setOnline: online => set({ online }),
    setStake: stake => set(state => ({ stake: typeof stake === "function" ? stake(state.stake) : stake })), setInvite: invite => set({ invite }),
    setInterval: interval => set({ interval }), setChartStyle: chartStyle => set({ chartStyle }),
    setHelpOpen: helpOpen => set({ helpOpen }),
  }));
}
