"use client";

import { useEffect } from "react";
import { AnimatePresence, animate, motion, useMotionValue } from "framer-motion";
import { useUi } from "../../providers/ui-provider.tsx";
import { TimerDial } from "./timer-dial.tsx";
import { ROUND_DURATION_MS, boundedTime } from "./timer-state.ts";
import styles from "./round-timer.module.css";

type Props = { milliseconds: bigint; funding: boolean; ended: boolean; stale: boolean };
const TIMING = { sweep: .25, digit: { type: "spring", stiffness: 380, damping: 34, mass: .8 } } as const;

function RollingSeconds({ seconds, reduced }: { seconds: number; reduced: boolean }) {
  const digits = String(seconds).padStart(2, "0");
  return <strong className={styles.number} aria-hidden="true" data-seconds={seconds}>
    {Array.from(digits, (digit, index) => <span className={styles.digit} key={index}>
      {reduced ? <span className={styles.glyph}>{digit}</span> : <AnimatePresence initial={false}>
        <motion.span className={styles.glyph} key={digit} initial={{ y: "100%", opacity: 0 }}
          animate={{ y: "0%", opacity: 1 }} exit={{ y: "-100%", opacity: 0 }} transition={TIMING.digit}>{digit}</motion.span>
      </AnimatePresence>}
    </span>)}
    <span className={styles.unit}>s</span>
  </strong>;
}

export function RoundTimer({ milliseconds, funding, ended, stale }: Props) {
  const reduced = useUi(state => state.reducedMotion);
  const remaining = ended ? 0 : funding ? ROUND_DURATION_MS : boundedTime(milliseconds);
  const seconds = Math.ceil(remaining / 1000);
  const ratio = remaining / ROUND_DURATION_MS;
  const progress = useMotionValue(ratio);
  const state = ended ? "ended" : funding ? "ready" : stale ? "stale" : seconds <= 10 ? "urgent" : "running";
  const label = ended ? "Round ended" : funding ? "Round duration" : stale ? "Estimate · stale" : "Time left · estimated";
  useEffect(() => {
    if (reduced || funding || ended || stale || Math.abs(progress.get() - ratio) > .05) {
      progress.set(ratio);
      return;
    }
    const playback = animate(progress, ratio, { duration: TIMING.sweep, ease: "linear" });
    return () => playback.stop();
  }, [ratio, reduced, funding, ended, stale, progress]);
  return <div className={styles.timer} data-state={state} data-remaining-ms={remaining} data-reduced-motion={reduced}
    role="timer" aria-live="off" aria-label={ended ? "Round ended" : funding ? "Round duration, 90 seconds" : `${stale ? "Stale estimate" : "Estimated time left"}, ${seconds} seconds`}>
    <span className={styles.label}>{label}</span>
    <div className={styles.readout}>
      <TimerDial progress={progress} muted={ended || stale && !funding} animated={!reduced && !stale && !funding && !ended && remaining > 0} />
      {ended ? <strong className={styles.end} aria-hidden="true">END</strong> : <RollingSeconds seconds={seconds} reduced={reduced || stale || funding} />}
    </div>
  </div>;
}
