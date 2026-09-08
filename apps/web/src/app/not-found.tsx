import { ArrowUpRight } from "lucide-react";
import { BrandLogo } from "../components/brand/logo.tsx";
import { PixelGarden } from "../features/not-found/pixel-garden.tsx";
import styles from "../features/not-found/not-found.module.css";

export default function NotFound() {
  return <main className={styles.page}>
    <div className={styles.header}>
      <a href="/" aria-label="FLINCH home" className={styles.home}><BrandLogo className="brand-status" /></a>
      <a href="/play">Back to arena<ArrowUpRight size={13} aria-hidden /></a>
    </div>
    <p className={styles.code}>404 / OFF THE BEATEN PATH</p>
    <PixelGarden />
  </main>;
}
