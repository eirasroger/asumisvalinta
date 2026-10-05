"use client";

import type { EChartsCoreOption } from "echarts/core";
import { useMemo } from "react";
import { EChart, INK_3, LINE, TOOLTIP_STYLE, tooltipBox } from "@/components/charts/EChart";
import { useI18n } from "@/i18n/I18nProvider";
import type { AskChart } from "@/lib/api";

const COLOURS = ["#2a78d6", "#1baf7a", "#eb6834"];

/** A chart the assistant asked for, drawn from its grounded figures. */
export function AnswerChart({ chart, delay }: { chart: AskChart; delay: number }) {
  const { locale } = useI18n();
  const option = useMemo<EChartsCoreOption>(() => {
    const number = new Intl.NumberFormat(locale === "fi" ? "fi-FI" : "en-IE", { maximumFractionDigits: 2 });
    const format = (value: number | null) => (value === null ? "–" : `${number.format(value)}${chart.unit ? ` ${chart.unit}` : ""}`);
    const bar = chart.kind === "bar";
    return {
      color: COLOURS,
      animationDuration: 900,
      animationEasing: "cubicOut",
      animationDelay: (index: number) => delay + index * 70,
      grid: { left: 4, right: 12, top: 12, bottom: 4, containLabel: true },
      tooltip: {
        trigger: "axis",
        ...TOOLTIP_STYLE,
        axisPointer: { type: bar ? "shadow" : "line", shadowStyle: { color: "rgba(26,37,48,0.04)" }, lineStyle: { color: LINE } },
        formatter: (items: { axisValue: string; color: string; seriesName: string; value: number | null }[]) =>
          tooltipBox(
            items[0]?.axisValue ?? "",
            items.map((item) => ({ color: item.color, label: item.seriesName, value: format(item.value) })),
          ),
      },
      xAxis: {
        type: "category",
        data: chart.categories,
        boundaryGap: bar,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: LINE } },
        axisLabel: { color: INK_3, fontSize: 12, hideOverlap: true },
      },
      yAxis: {
        type: "value",
        splitNumber: 4,
        splitLine: { lineStyle: { color: LINE, type: "dashed" } },
        axisLabel: { color: INK_3, fontSize: 11, formatter: (value: number) => number.format(value) },
      },
      series: chart.series.map((item, index) =>
        bar
          ? {
              type: "bar",
              name: item.name,
              data: item.values,
              barMaxWidth: 30,
              barGap: "18%",
              itemStyle: { borderRadius: [6, 6, 0, 0] },
            }
          : {
              type: "line",
              name: item.name,
              data: item.values,
              smooth: true,
              symbol: "circle",
              symbolSize: 6,
              lineStyle: { width: 2.5 },
              areaStyle:
                chart.series.length === 1
                  ? {
                      color: {
                        type: "linear",
                        x: 0,
                        y: 0,
                        x2: 0,
                        y2: 1,
                        colorStops: [
                          { offset: 0, color: `${COLOURS[index]}29` },
                          { offset: 1, color: `${COLOURS[index]}00` },
                        ],
                      },
                    }
                  : undefined,
            },
      ),
    };
  }, [chart, delay, locale]);

  return (
    <figure className="soft-in mt-4 rounded-xl bg-frost p-4" style={{ animationDelay: `${delay}ms` }}>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-[13px] font-semibold">
          {chart.title}
          {chart.unit && <span className="font-normal text-ink-3"> · {chart.unit}</span>}
        </span>
        {chart.series.length > 1 && (
          <span className="flex flex-wrap gap-3 text-xs text-ink-2">
            {chart.series.map((item, index) => (
              <span key={item.name} className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: COLOURS[index] }} />
                {item.name}
              </span>
            ))}
          </span>
        )}
      </figcaption>
      <p className="mt-3 text-[11px] text-ink-3">{chart.y_label}</p>
      <div className="mt-1">
        <EChart option={option} height={220} label={chart.title} replace />
      </div>
      <p className="mt-1 text-center text-[11px] text-ink-3">{chart.x_label}</p>
    </figure>
  );
}
