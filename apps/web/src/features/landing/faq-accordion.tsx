"use client";

import { useEffect, useRef } from "react";
import { ArrowUpRight, Flag, FlaskConical, Plus, ShieldCheck, UsersRound } from "lucide-react";
import { enhanceFaq } from "./faq-motion.ts";
import styles from "./faq.module.css";

const icons = [FlaskConical, ArrowUpRight, UsersRound, ShieldCheck, Flag];

export function FaqAccordion({ questions }: { questions: readonly { question: string; answer: string }[] }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!root.current || !window.ResizeObserver) return;
    return enhanceFaq(root.current);
  }, []);

  return <div ref={root} className={styles.stack} data-faq="">
    {questions.map(({ question, answer }, index) => {
      const Icon = icons[index % icons.length];
      return <details key={question} className={styles.item}>
        <summary aria-controls={`faq-answer-${index}`}>
          <Icon size={18} strokeWidth={1.6} className={styles.icon} aria-hidden />
          <span className={styles.question}>{question}</span>
          <span className={styles.toggle}><Plus size={16} strokeWidth={1.6} aria-hidden /></span>
        </summary>
        <div className={styles.flow} data-faq-flow="" aria-hidden="true" />
        <div id={`faq-answer-${index}`} data-faq-content="" className={styles.answer}>
          <p>{answer}</p>
        </div>
      </details>;
    })}
  </div>;
}
