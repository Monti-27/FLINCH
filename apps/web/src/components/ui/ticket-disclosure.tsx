import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import styles from "./ticket-disclosure.module.css";

export function TicketDisclosure({ title, children, className = "" }: { title: ReactNode; children: ReactNode; className?: string }) {
  return <details className={`${styles.disclosure} ${className}`}>
    <summary>{title}<ChevronDown size={14} aria-hidden /></summary>
    <div className={styles.body}>{children}</div>
  </details>;
}
