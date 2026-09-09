export type PlayerRailMode = "closed" | "open";
export type PlayerRailEvent = "open" | "dismiss";

export function nextPlayerRailMode(event: PlayerRailEvent): PlayerRailMode {
  return event === "open" ? "open" : "closed";
}
