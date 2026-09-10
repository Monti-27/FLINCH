"use client";

import { Footer } from "../../../components/shell/footer.tsx";
import type { WebConfig } from "../../../lib/config.ts";
import { useLandingTheme } from "./provider.tsx";

export function LandingFooter({ config }: { config: Pick<WebConfig, "network" | "transactions"> }) {
  const { theme } = useLandingTheme();
  return <Footer config={config} arenaHref="/play" theme={theme} />;
}
