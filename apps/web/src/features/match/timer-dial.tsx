"use client";

import { useEffect } from "react";
import { motion, useSpring, useTransform } from "framer-motion";
import type { MotionValue } from "framer-motion";
import { DIAL_TICKS, DIAL_INNER_RADIUS, dialColor, tickFill, tickLength } from "./timer-state.ts";
import styles from "./round-timer.module.css";

const BAR_SPRING = { stiffness: 360, damping: 16, mass: .65 };
const INNER_EDGE = 50 - DIAL_INNER_RADIUS;

function DialTick({ index, progress, animated }: { index: number; progress: MotionValue<number>; animated: boolean }) {
  const fill = useTransform(progress, value => tickFill(value, index));
  const length = useSpring(tickLength(progress.get(), index), BAR_SPRING);
  const y = useTransform(length, value => INNER_EDGE - value);
  useEffect(() => {
    length.jump(tickLength(progress.get(), index));
    return progress.on("change", value => {
      const target = tickLength(value, index);
      if (animated) length.set(target);
      else length.jump(target);
    });
  }, [animated, progress, index, length]);
  return <g transform={`rotate(${index * 360 / DIAL_TICKS} 50 50)`}>
    <motion.line x1="50" y1={INNER_EDGE} x2="50" y2={y} className={styles.track} />
    <motion.line x1="50" y1={INNER_EDGE} x2="50" y2={y} opacity={fill} className={styles.ray} />
  </g>;
}

export function TimerDial({ progress, muted, animated }: { progress: MotionValue<number>; muted: boolean; animated: boolean }) {
  const color = useTransform(progress, dialColor);
  return <motion.svg className={styles.dial} viewBox="0 0 100 100" fill="none" aria-hidden="true" focusable="false"
    style={{ color: muted ? "var(--muted-foreground)" : color }}>
    {Array.from({ length: DIAL_TICKS }, (_, index) => <DialTick key={index} index={index} progress={progress} animated={animated} />)}
  </motion.svg>;
}
