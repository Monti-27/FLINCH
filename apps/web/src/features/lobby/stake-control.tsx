"use client";

import { forwardRef, useState } from "react";
import type { CSSProperties, SetStateAction } from "react";
import { Minus, Plus } from "lucide-react";
import { EcosystemIcon } from "../../components/brand/ecosystem-icon.tsx";
import AnimatedNumberCounter from "../../components/ui/count-down-numbers.tsx";
import { normalizeNumber } from "../../components/ui/number-value.ts";
import { MAX_STAKE, MIN_STAKE, STAKE_PRESETS, stakeFromSlider, stakeSliderIndex, stakeUnits, stepStake } from "./stake-value.ts";
import styles from "./stake-control.module.css";

type Props = { value: string; onChange: (value: SetStateAction<string>) => void; invalid: boolean; disabled: boolean };

export const StakeControl = forwardRef<HTMLInputElement, Props>(function StakeControl({ value, onChange, invalid, disabled }, ref) {
  const [editing, setEditing] = useState(false);
  const units = stakeUnits(value);
  const index = stakeSliderIndex(value);
  const normalized = normalizeNumber(value);
  const displayNumber = normalized === value;
  const preset = STAKE_PRESETS.findIndex(amount => stakeUnits(amount) === units);
  const style = { "--stake-progress": `${index / 90 * 100}%`, "--preset-index": Math.max(0, preset) } as CSSProperties;

  return <section className={`token-input ${styles.control}`} aria-label="Choose your stake" style={style} data-invalid={invalid} data-disabled={disabled}>
    <div className={styles.heading}><label htmlFor="stake">Stake per player</label><span>Equal for all four</span></div>
    <div className={styles.valueRow}>
      <div className={`token-unit ${styles.identity}`}><EcosystemIcon name="solana" size={20} /><span>SOL</span></div>
    <div className={`token-input-value ${styles.amount}`} data-editing={editing} data-precise={value.length > 7}>
      <span className={styles.rolling} aria-hidden>
        {!editing && (displayNumber ? <AnimatedNumberCounter value={value} flashOnChange={false} /> : <span>{value || "0"}</span>)}
      </span>
      <input ref={ref} id="stake" name="stake" type="text" inputMode="decimal" autoComplete="off" spellCheck={false}
        value={value} onChange={event => onChange(event.target.value)} onFocus={() => setEditing(true)} onBlur={() => setEditing(false)}
        onKeyDown={event => {
          if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
          event.preventDefault();
          const direction = event.key === "ArrowUp" ? 1 : -1;
          const fine = event.shiftKey;
          onChange(current => stepStake(current, direction, fine));
        }}
        aria-label="Stake per player, in SOL" aria-invalid={invalid} aria-describedby="stake-range-help stake-help"
        maxLength={20} disabled={disabled} required />
    </div>
    </div>
    <p id="stake-range-help" className="sr-only">Enter between 0.001 and 0.01 SOL. Use the amount field for exact entry.</p>
    <div className={styles.adjustment}>
      <button className={styles.step} type="button" aria-label="Decrease stake by 0.001 SOL" disabled={disabled || units === MIN_STAKE}
        onClick={event => { const fine = event.shiftKey; onChange(current => stepStake(current, -1, fine)); }}><Minus size={18} aria-hidden /></button>
      <div className={styles.range}>
        <div className={styles.track} aria-hidden><span /></div>
        <input type="range" min="0" max="90" step="1" value={index} disabled={disabled}
          aria-label="Adjust stake" aria-valuetext={`${value || "No amount"} SOL per player`} aria-describedby="stake-range-help"
          onChange={event => { const next = stakeFromSlider(event.target.value); if (next !== null) onChange(next); }} />
      </div>
      <button className={styles.step} type="button" aria-label="Increase stake by 0.001 SOL" disabled={disabled || units === MAX_STAKE}
        onClick={event => { const fine = event.shiftKey; onChange(current => stepStake(current, 1, fine)); }}><Plus size={18} aria-hidden /></button>
    </div>
    <div className={`stake-presets ${styles.presets}`} role="group" aria-label="Stake presets" data-appearance="keys" data-selected={preset >= 0}>
      {STAKE_PRESETS.map(amount => <button key={amount} type="button" aria-label={amount === "0.01" ? "Use maximum stake, 0.01 SOL" : `${amount} SOL`} aria-pressed={stakeUnits(amount) === units}
        disabled={disabled} onClick={() => onChange(amount)}>{amount === "0.01" ? "Max" : amount}</button>)}
    </div>
  </section>;
});
