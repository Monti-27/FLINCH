import { CandlestickChart, ChartArea, ChartLine, ChartNoAxesColumn, ChevronDown } from "lucide-react";
import { CHART_STYLES } from "./chart-options.ts";
import type { ChartStyle } from "./chart-options.ts";

const icons = { candles: CandlestickChart, hollow: CandlestickChart, bars: ChartNoAxesColumn, line: ChartLine, mountain: ChartArea };

export function ChartStyleSelect({ value, onChange }: { value: ChartStyle; onChange: (value: ChartStyle) => void }) {
  const Icon = icons[value];
  return <div className="chart-style-select">
    <Icon className="chart-style-icon" size={16} aria-hidden />
    <select aria-label="Chart style" value={value} onChange={event => {
      const option = CHART_STYLES.find(style => style.value === event.target.value);
      if (option) onChange(option.value);
    }}>
      {CHART_STYLES.map(style => <option key={style.value} value={style.value}>{style.label}</option>)}
    </select>
    <ChevronDown className="chart-style-chevron" size={12} aria-hidden />
  </div>;
}
