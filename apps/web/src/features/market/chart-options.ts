export const CHART_INTERVALS = [60, 120, 300] as const;
export type ChartInterval = typeof CHART_INTERVALS[number];
export const CHART_STYLES = [
  { value: "candles", label: "Candles" },
  { value: "hollow", label: "Hollow candles" },
  { value: "bars", label: "OHLC bars" },
  { value: "line", label: "Line" },
  { value: "mountain", label: "Mountain" },
] as const;
export type ChartStyle = typeof CHART_STYLES[number]["value"];

export function chartInterval(span: number): ChartInterval {
  const interval = CHART_INTERVALS.find(value => value === span * 60);
  if (!interval) throw new Error("Unsupported chart interval");
  return interval;
}
