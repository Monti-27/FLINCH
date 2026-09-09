"use client";

import { AnimatePresence, motion, useTransform } from "framer-motion";
import { useUi } from "../../providers/ui-provider.tsx";
import { TimerDial } from "./timer-dial.tsx";
import { ROUND_DURATION_MS } from "./timer-state.ts";
import { useCountdown } from "./use-countdown.ts";
import type { TimerObservation } from "./countdown-clock.ts";
import styles from "./round-timer.module.css";

type Props = { milliseconds: bigint; funding: boolean; ended: boolean; stale: boolean; observation?: TimerObservation };
const TIMING = { digit: { type: "spring", stiffness: 380, damping: 34, mass: .8 } } as const;

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

export function RoundTimer({ milliseconds, funding, ended, stale, observation }: Props) {
  const reduced = useUi(state => state.reducedMotion);
  const { remaining, seconds } = useCountdown(milliseconds, funding, ended, observation);
  const progress = useTransform(remaining, value => value / ROUND_DURATION_MS);
  const state = ended ? "ended" : funding ? "ready" : stale ? "stale" : seconds <= 10 ? "urgent" : "running";
  const label = ended ? "Round ended" : funding ? "Round duration" : stale ? "Estimate · stale" : "Time left · estimated";
  return <div className={styles.timer} data-state={state} data-remaining-ms={Math.round(remaining.get())} data-reduced-motion={reduced}
    role="timer" aria-live="off" aria-label={ended ? "Round ended" : funding ? "Round duration, 90 seconds" : `${stale ? "Stale estimate" : "Estimated time left"}, ${seconds} seconds`}>
    <span className={styles.label}>{label}</span>
    <div className={styles.readout}>
      <TimerDial progress={progress} muted={ended || stale && !funding} animated={!reduced && !stale && !funding && !ended && seconds > 0} />
      {ended ? <strong className={styles.end} aria-hidden="true">END</strong> : <RollingSeconds seconds={seconds} reduced={reduced || stale || funding} />}
    </div>
  </div>;
}
