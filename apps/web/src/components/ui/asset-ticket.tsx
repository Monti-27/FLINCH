import type { ReactNode } from "react";
import { EcosystemIcon } from "../brand/ecosystem-icon.tsx";
import styles from "./asset-ticket.module.css";

export function AssetTicket({ label, detail, symbol, amount, precise = false, children }: {
  label: string; detail?: string; symbol: "SOL" | "WSOL" | "USDC"; amount: ReactNode; precise?: boolean; children?: ReactNode;
}) {
  return <div className={styles.ticket}>
    <div className={styles.heading}><span>{label}</span>{detail && <span>{detail}</span>}</div>
    <div className={styles.row}>
      <span className={styles.token}><EcosystemIcon name={symbol === "USDC" ? "usdc" : "solana"} size={20} />{symbol}</span>
      <div className={styles.amount} data-precise={precise}>{amount}</div>
    </div>
    {children}
  </div>;
}
