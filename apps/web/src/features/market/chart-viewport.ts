import type { Chart } from "klinecharts";

type Viewport = Pick<Chart, "getDataList" | "getVisibleRange" | "getBarSpace" | "scrollByDistance" | "resetData">;

export function refreshChart(chart: Viewport) {
  const bars = chart.getDataList();
  const range = chart.getVisibleRange();
  const index = Math.max(0, Math.min(bars.length - 1, range.to - 1));
  const anchor = range.realTo < bars.length ? bars[index]?.timestamp : undefined;
  const remainder = range.realTo - index;
  chart.resetData();
  if (anchor === undefined) return;
  const next = chart.getDataList().findIndex(bar => bar.timestamp >= anchor);
  if (next < 0) return;
  const distance = (chart.getVisibleRange().realTo - next - remainder) * chart.getBarSpace().bar;
  chart.scrollByDistance(distance, 0);
}
