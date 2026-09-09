import type { CSSProperties, ReactNode } from "react";

type Option<T> = { value: T; label: ReactNode; name?: string };
type Props<T> = {
  label: string; value: T; options: readonly Option<T>[]; onChange: (value: T) => void;
  className?: string; appearance?: "inset" | "keys" | "tabs";
};

export function SegmentedControl<T extends string | number>({ label, value, options, onChange, className = "", appearance = "inset" }: Props<T>) {
  const index = options.findIndex(option => option.value === value);
  return <div className={`segmented ${className}`} data-appearance={appearance} data-selected={index >= 0} role="group" aria-label={label}
    style={{ "--segment-count": options.length, "--segment-index": Math.max(index, 0) } as CSSProperties}>
    {options.map(option => <button key={option.value} type="button" aria-label={option.name}
      aria-pressed={option.value === value} onClick={() => onChange(option.value)}>{option.label}</button>)}
  </div>;
}
