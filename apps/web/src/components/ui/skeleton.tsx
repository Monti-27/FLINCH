import type { CSSProperties, ReactNode } from "react";
import styles from "./skeleton.module.css";

export function Skeleton({ width = "100%", height = "1em", round = false, className = "" }: {
  width?: CSSProperties["width"]; height?: CSSProperties["height"]; round?: boolean; className?: string;
}) {
  return <span aria-hidden="true" className={`${styles.shape} ${className}`} data-skeleton="" data-round={round || undefined} style={{ width, height }} />;
}

export function SkeletonGroup({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return <div className={className} role="status" aria-label={label} aria-busy="true" data-loading="">
    <span className="sr-only">{label}</span>{children}
  </div>;
}
