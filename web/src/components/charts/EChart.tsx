"use client";

import { BarChart, LineChart } from "echarts/charts";
import { GridComponent, MarkLineComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import type { EChartsCoreOption } from "echarts/core";
import { SVGRenderer } from "echarts/renderers";
import { useEffect, useRef } from "react";

echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, MarkLineComponent, SVGRenderer]);

export const FONT = "var(--font-schibsted), system-ui, sans-serif";
export const INK = "#1a2530";
export const INK_2 = "#4b5866";
export const INK_3 = "#7c8794";
export const LINE = "#e2e7ec";

/** Thin React wrapper: one chart instance per element, options merged so updates animate. */
export function EChart({
  option,
  height,
  label,
  replace = false,
}: {
  option: EChartsCoreOption;
  height: number;
  label: string;
  replace?: boolean;
}) {
  const element = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!element.current) return;
    const instance = echarts.init(element.current, null, { renderer: "svg" });
    chart.current = instance;
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(element.current);
    return () => {
      observer.disconnect();
      instance.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    const fontFamily = getComputedStyle(document.body).fontFamily;
    chart.current?.setOption({ textStyle: { fontFamily }, ...option }, { notMerge: replace, lazyUpdate: true });
  }, [option, replace]);

  return <div ref={element} role="img" aria-label={label} style={{ height }} className="w-full" />;
}

export function tooltipBox(title: string, rows: { color: string; label: string; value: string }[]) {
  const items = rows
    .map(
      (row) =>
        `<div style="display:flex;align-items:center;gap:8px;justify-content:space-between;padding:2px 0">` +
        `<span style="display:flex;align-items:center;gap:8px;color:${INK_2}">` +
        `<span style="width:8px;height:8px;border-radius:99px;background:${row.color}"></span>${row.label}</span>` +
        `<span style="font-weight:600;color:${INK};font-variant-numeric:tabular-nums">${row.value}</span></div>`,
    )
    .join("");
  return `<div style="min-width:180px;font-family:${FONT};font-size:13px"><div style="color:${INK_3};margin-bottom:4px">${title}</div>${items}</div>`;
}

export const TOOLTIP_STYLE = {
  backgroundColor: "#ffffff",
  borderColor: LINE,
  borderWidth: 1,
  padding: [10, 12],
  extraCssText: "border-radius:10px;box-shadow:0 8px 24px -6px rgba(26,37,48,.18);",
};
