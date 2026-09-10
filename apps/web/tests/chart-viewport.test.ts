import { expect, it, vi } from "vitest";
import { refreshChart } from "../src/features/market/chart-viewport.ts";

function chartView(realTo: number, retained = [120, 180, 240, 300, 360]) {
  const bar = (timestamp: number) => ({ timestamp, open: 10, high: 12, low: 9, close: 11 });
  let bars = [60, 120, 180, 240, 300].map(bar);
  let range = { from: 0, to: Math.min(5, Math.ceil(realTo)), realFrom: realTo - 4, realTo };
  return {
    getDataList: () => bars,
    getVisibleRange: () => range,
    getBarSpace: () => ({ bar: 10, halfBar: 5, gapBar: 8, halfGapBar: 4 }),
    scrollByDistance: vi.fn(),
    resetData: () => { bars = retained.map(bar); range = { from: 0, to: 5, realFrom: 3, realTo: 7 }; },
  };
}

it("keeps a historical timestamp in place through rolling retention", () => {
  const chart = chartView(3.5);
  refreshChart(chart);
  expect(chart.scrollByDistance).toHaveBeenCalledWith(45, 0);
});

it("leaves a live-following viewport on the newest bars", () => {
  const chart = chartView(7);
  refreshChart(chart);
  expect(chart.scrollByDistance).not.toHaveBeenCalled();
});

it("clamps a pruned historical anchor to the earliest retained observation", () => {
  const chart = chartView(1.5, [240, 300, 360, 420, 480]);
  refreshChart(chart);
  expect(chart.scrollByDistance).toHaveBeenCalledWith(65, 0);
});
