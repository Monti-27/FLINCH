import { MarketPanel } from "../../features/market/market-panel.tsx";
import { ArenaLayout } from "./arena-layout.tsx";
import type { ArenaLayoutProps } from "./arena-layout.tsx";

export function ArenaWorkspace(props: Omit<ArenaLayoutProps, "market">) {
  return <ArenaLayout {...props} market={<MarketPanel />} />;
}
