import type { DeepPartial, Styles } from "klinecharts";
import type { ChartStyle } from "./chart-options.ts";

export function chartPresentation(style: ChartStyle, token: (name: string) => string): DeepPartial<Styles> {
  const type = { candles: "candle_solid", hollow: "candle_up_stroke", bars: "ohlc", line: "area", mountain: "area" } as const;
  const line = style === "line" || style === "mountain";
  return { candle: {
    type: type[style],
    area: { backgroundColor: style === "mountain" ? token("--chart-mountain") : "transparent" },
    priceMark: { last: {
      upColor: token(line ? "--chart-line" : "--chart-up"),
      downColor: token(line ? "--chart-line" : "--chart-down"),
      noChangeColor: token("--chart-line"),
    } },
    tooltip: { legend: { template: line ? [{ title: "Close ", value: "{close}" }] : [
      { title: "O ", value: "{open}" }, { title: "H ", value: "{high}" },
      { title: "L ", value: "{low}" }, { title: "C ", value: "{close}" },
    ] } },
  } };
}

export function chartTheme(token: (name: string) => string): DeepPartial<Styles> {
  const up = token("--chart-up");
  const down = token("--chart-down");
  const neutral = token("--chart-muted");
  const font = token("--font-mono");
  const direction = { upColor: up, downColor: down, noChangeColor: neutral };
  const axis = { axisLine: { show: false }, tickLine: { show: false }, tickText: { color: neutral, family: font, size: 12 } };
  const crosshair = {
    line: { color: token("--chart-crosshair"), style: "dashed" as const, dashedValue: [3, 3] },
    text: { color: token("--chart-text"), backgroundColor: token("--chart-selected"), borderColor: token("--chart-border"), family: font, size: 12, borderRadius: 2 },
  };
  return {
    grid: { horizontal: { color: token("--chart-grid"), style: "solid", size: 1 }, vertical: { show: false } },
    candle: {
      type: "candle_solid",
      bar: { ...direction, upBorderColor: up, downBorderColor: down, noChangeBorderColor: neutral, upWickColor: up, downWickColor: down, noChangeWickColor: neutral },
      area: { smooth: false, lineSize: 1.5, lineColor: token("--chart-line"), backgroundColor: "transparent", point: { show: false, animation: false } },
      priceMark: {
        high: { show: false }, low: { show: false },
        last: { ...direction, line: { style: "dashed", dashedValue: [3, 3], size: 1 }, text: { color: token("--chart"), family: font, size: 12, borderRadius: 2 }, extendTexts: [] },
      },
      tooltip: {
        showRule: "always", showType: "standard", offsetLeft: 12, offsetTop: 8,
        title: { show: false },
        legend: { size: 12, family: font, color: neutral, marginLeft: 0, marginRight: 12, template: [
          { title: "O ", value: "{open}" }, { title: "H ", value: "{high}" },
          { title: "L ", value: "{low}" }, { title: "C ", value: "{close}" },
        ] },
      },
    },
    indicator: {
      bars: [{ ...direction, style: "fill" }],
      lastValueMark: { show: false },
      tooltip: { offsetLeft: 12, offsetTop: 6, title: { show: true, showName: true, showParams: false, size: 11, family: font, color: neutral }, legend: { size: 11, family: font, color: neutral, defaultValue: "—" } },
    },
    xAxis: { ...axis, size: 30 }, yAxis: { ...axis, size: 64 },
    separator: { color: token("--chart-border"), size: 1, fill: false, activeBackgroundColor: token("--chart-selected") },
    crosshair: { horizontal: crosshair, vertical: crosshair },
  };
}
