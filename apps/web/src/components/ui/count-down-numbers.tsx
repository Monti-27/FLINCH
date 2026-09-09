"use client";

import { useEffect, useState } from "react";
import NumberFlow, { useCanAnimate } from "@number-flow/react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { advanceNumber, normalizeNumber } from "./number-value.ts";
import type { NumberChange, NumberValue } from "./number-value.ts";
import styles from "./count-down-numbers.module.css";

const TIMING = {
  roll: { duration: 250, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
  opacity: { duration: 100, easing: "ease-out" },
  feedback: 1000,
};

export type AnimatedNumberProps = {
  value: NumberValue;
  prefix?: string;
  suffix?: string;
  minimumIntegerDigits?: number;
  flashOnChange?: boolean;
  identity?: string;
  className?: string;
};

export default function AnimatedNumberCounter({ identity, ...props }: AnimatedNumberProps) {
  return <NumberPresentation key={identity} {...props} />;
}

function NumberPresentation({ value, prefix = "", suffix = "", minimumIntegerDigits = 1, flashOnChange = true, className = "" }: AnimatedNumberProps) {
  const decimal = normalizeNumber(value);
  const canAnimate = useCanAnimate();
  const [change, setChange] = useState<NumberChange>({ value: decimal, direction: 0, revision: 0 });
  const [settled, setSettled] = useState(0);
  if (change.value !== decimal) setChange(advanceNumber(change, decimal));
  useEffect(() => {
    if (!canAnimate || !flashOnChange || change.direction === 0) {
      setSettled(change.revision);
      return;
    }
    const timer = window.setTimeout(() => setSettled(change.revision), TIMING.feedback);
    return () => window.clearTimeout(timer);
  }, [change.revision, change.direction, canAnimate, flashOnChange]);
  const direction = canAnimate && flashOnChange && settled !== change.revision ? change.direction : 0;
  const fractionDigits = decimal?.split(".")[1]?.length ?? 0;
  const places = Math.max(1, Math.min(21, Math.trunc(minimumIntegerDigits) || 1));
  const [whole, fraction] = decimal?.split(".") ?? [""];
  const formatted = `${whole.startsWith("-") ? "-" : ""}${whole.replace(/^-/, "").padStart(places, "0")}${fraction === undefined ? "" : `.${fraction}`}`;
  const label = decimal === null ? "No data" : `${prefix}${formatted}${suffix}`;
  return <span className={`${styles.value} ${className}`} data-number-value={decimal ?? "unavailable"}
    data-number-direction={direction === 1 ? "up" : direction === -1 ? "down" : "neutral"}
    data-number-motion={canAnimate ? "enabled" : "disabled"}>
    {decimal === null ? <span aria-label={label}>—</span> : <NumberFlow value={decimal} locales="en-US"
      format={{ useGrouping: false, minimumIntegerDigits: places, minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }}
      prefix={prefix} suffix={suffix} role="img" aria-label={label} className={styles.digits} trend={change.direction}
      animated={canAnimate} respectMotionPreference transformTiming={TIMING.roll} spinTiming={TIMING.roll} opacityTiming={TIMING.opacity} />}
    {flashOnChange && decimal !== null && <span className={styles.direction} aria-hidden data-visible={direction !== 0}>
      {direction === -1 ? <ArrowDown /> : <ArrowUp />}
    </span>}
  </span>;
}
