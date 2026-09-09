"use client";

import { useEffect, useId, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useUi } from "../../providers/ui-provider.tsx";
import styles from "./round-terms.module.css";

const TIMING = { spring: { type: "spring" as const, stiffness: 300, damping: 32 }, fade: 0.15 };

export function RoundTerms() {
  const [open, setOpen] = useState(false);
  const [height, setHeight] = useState(0);
  const reduced = useUi(state => state.reducedMotion);
  const content = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    const element = content.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setHeight(element.getBoundingClientRect().height));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <div className={styles.terms} data-open={open} onKeyDown={event => {
    if (event.key === "Escape" && open) { event.stopPropagation(); setOpen(false); }
  }}>
    <button className={styles.trigger} type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
      <span>Sell penalty</span><span className={styles.value}>0.25% <ChevronDown size={14} aria-hidden /></span>
    </button>
    <motion.div id={id} className={styles.reveal} inert={!open} aria-hidden={!open} initial={false}
      animate={{ height: open ? height : 0, opacity: open ? 1 : 0 }}
      transition={reduced ? { duration: 0 } : { height: TIMING.spring, opacity: { duration: TIMING.fade } }}>
      <div ref={content} className={styles.content}>
        <p>Paid to the players still holding when your sale completes. No game penalty if everyone sells together.</p>
        <dl><div><dt>Protocol fee</dt><dd>0%</dd></div><div><dt>Round length</dt><dd>90 seconds</dd></div></dl>
        <p>SOL wraps to WSOL on deposit. Network fees, account rent and swap fees are separate.</p>
      </div>
    </motion.div>
  </div>;
}
