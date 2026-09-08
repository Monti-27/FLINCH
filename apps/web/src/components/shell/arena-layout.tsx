import type { ReactNode } from "react";

export type ArenaLayoutProps = { overview: ReactNode; players: ReactNode; children: ReactNode; market: ReactNode; notice?: ReactNode; history?: ReactNode };

export function ArenaLayout({ overview, players, children, market, notice, history }: ArenaLayoutProps) {
  return <section className="arena-shell">
    <div className="arena-content">
      {notice}
      <div className="lobby-workspace">
        {overview}
        {players}
        {children}
        {market}
        {history && <div className="round-history">{history}</div>}
      </div>
    </div>
  </section>;
}
