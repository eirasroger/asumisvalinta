"use client";

import { Tabs } from "radix-ui";
import { useMemo, useState } from "react";
import { EChart, INK_2, INK_3, LINE, TOOLTIP_STYLE, tooltipBox } from "@/components/charts/EChart";
import { Dot, Money, Popover } from "@/components/ui";
import { OPTION_LABELS, type Option, type OptionResult, type PlannerRun } from "@/lib/api";
import { formatCompactEuro, formatEuro } from "@/lib/format";

const ORDER: Option[] = ["buy", "rent", "aso"];
const COLORS: Record<Option, string> = { buy: "#2a78d6", rent: "#eb6834", aso: "#1baf7a" };
const GERUND: Record<Option, string> = { buy: "buying", rent: "renting", aso: "right of occupancy" };

const BREAKDOWN: Record<string, { label: string; sign: 1 | -1 }> = {
  home_value: { label: "Flat sold for", sign: 1 },
  selling_costs: { label: "Selling costs", sign: -1 },
  mortgage_left: { label: "Mortgage repaid", sign: -1 },
  housing_company_loan_left: { label: "Company loan repaid", sign: -1 },
  fee_refund: { label: "Fee refunded", sign: 1 },
  portfolio_value: { label: "Savings", sign: 1 },
  tax: { label: "Tax on gains", sign: -1 },
};

type View = "wealth" | "cost" | "stress";

function ordered(run: PlannerRun) {
  const options = ORDER.map((option) => run.result.options.find((item) => item.option === option)).filter(
    (item): item is OptionResult => Boolean(item),
  );
  return { options, ranked: [...options].sort((a, b) => b.end_wealth - a.end_wealth) };
}

export function Outcome({ run, loading }: { run: PlannerRun; loading: boolean }) {
  const { result, monthly_costs: costs } = run;
  const horizon = result.horizon_years;
  const { options, ranked } = ordered(run);
  const [best, second, third] = ranked;
  const [view, setView] = useState<View>("wealth");
  const [table, setTable] = useState(false);
  const firstYear = costs[0] ?? { year: 1 };

  return (
    <div className="space-y-5">
      <section aria-live="polite" className="px-1">
        <p className="flex items-center gap-2 text-[15px] text-ink-2">
          <Dot color={COLORS[best.option]} />
          <span>
            <span className="font-semibold text-ink">{OPTION_LABELS[best.option]}</span> comes out ahead over {horizon}{" "}
            {horizon === 1 ? "year" : "years"}
          </span>
        </p>
        <p className="mt-1 text-[56px] leading-none font-semibold tracking-[-0.03em]">
          <Money value={best.end_wealth - second.end_wealth} signed />
        </p>
        <p className="mt-2 text-[15px] text-ink-2">
          more than {GERUND[second.option]}
          {third && (
            <>
              , <span className="num font-medium text-ink">{formatEuro(best.end_wealth - third.end_wealth)}</span> more than{" "}
              {GERUND[third.option]}
            </>
          )}
        </p>
      </section>

      <section className="relative overflow-hidden rounded-xl border border-line bg-paper">
        {loading && <div className="busy absolute inset-x-0 top-0 h-0.5 overflow-hidden" />}
        <Tabs.Root value={view} onValueChange={(next) => setView(next as View)}>
          <div className="flex items-center gap-2 border-b border-line px-5">
            <Tabs.List aria-label="Chart" className="flex gap-5">
              {(
                [
                  ["wealth", "Wealth"],
                  ["cost", "Monthly cost"],
                  ["stress", "What if"],
                ] as const
              ).map(([value, label]) => (
                <Tabs.Trigger
                  key={value}
                  value={value}
                  className="-mb-px h-12 border-b-2 border-transparent text-sm text-ink-3 transition-colors hover:text-ink data-[state=active]:border-ink data-[state=active]:font-medium data-[state=active]:text-ink"
                >
                  {label}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
            {view !== "stress" && (
              <button type="button" onClick={() => setTable(!table)} className="ml-auto text-[13px] text-ink-3 hover:text-ink">
                {table ? "Chart" : "Table"}
              </button>
            )}
          </div>
          <div key={options.map((item) => item.option).join()} className="px-3 pt-3 pb-1 sm:px-4">
            <Tabs.Content value="wealth">
              {table ? <YearTable run={run} kind="wealth" /> : <WealthChart run={run} />}
            </Tabs.Content>
            <Tabs.Content value="cost">{table ? <YearTable run={run} kind="cost" /> : <CostChart run={run} />}</Tabs.Content>
            <Tabs.Content value="stress">
              <WhatIfTable run={run} />
            </Tabs.Content>
          </div>
        </Tabs.Root>

        <table className="num w-full border-t border-line text-sm">
          <thead>
            <tr className="text-left text-[13px] text-ink-3">
              <th className="py-2.5 pl-5 font-normal">Option</th>
              <th className="py-2.5 text-right font-normal">Wealth after {horizon} yrs</th>
              <th className="py-2.5 text-right font-normal max-sm:hidden">Monthly, year 1</th>
              <th className="py-2.5 pr-5 text-right font-normal">Upfront</th>
            </tr>
          </thead>
          <tbody>
            {options.map((item) => (
              <tr key={item.option} className="border-t border-line">
                <td className="py-3 pl-5">
                  <span className="flex items-center gap-2.5 font-medium">
                    <Dot color={COLORS[item.option]} />
                    {OPTION_LABELS[item.option]}
                  </span>
                </td>
                <td className="py-3 text-right">
                  <Popover
                    trigger={
                      <button
                        type="button"
                        className={`underline decoration-line-strong decoration-dotted underline-offset-4 hover:decoration-ink ${
                          item === best ? "font-semibold" : ""
                        }`}
                      >
                        <Money value={item.end_wealth} />
                      </button>
                    }
                  >
                    <Breakdown item={item} />
                  </Popover>
                </td>
                <td className="py-3 text-right max-sm:hidden">{formatEuro(firstYear[item.option] ?? 0)}</td>
                <td className="py-3 pr-5 text-right">{formatEuro(item.upfront_payment)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Breakdown({ item }: { item: OptionResult }) {
  const parts = Object.entries(item.breakdown).filter(([key, value]) => key in BREAKDOWN && Math.abs(value) >= 1);
  return (
    <dl className="num space-y-1.5 text-[13px]">
      {parts.map(([key, value]) => (
        <div key={key} className="flex justify-between gap-4">
          <dt className="text-ink-2">{BREAKDOWN[key].label}</dt>
          <dd>
            {BREAKDOWN[key].sign < 0 ? "−" : ""}
            {formatEuro(Math.abs(value))}
          </dd>
        </div>
      ))}
      <div className="flex justify-between border-t border-line pt-1.5 font-semibold">
        <dt>You walk away with</dt>
        <dd>{formatEuro(item.end_wealth)}</dd>
      </div>
    </dl>
  );
}

const AXIS_LABEL = { color: INK_3, fontSize: 12 };

function lineSeries(options: Option[], values: (option: Option) => number[], step = false) {
  return options.map((option) => ({
    name: OPTION_LABELS[option],
    type: "line",
    data: values(option),
    smooth: step ? false : 0.25,
    step: step ? "middle" : false,
    symbol: "circle",
    symbolSize: 7,
    showSymbol: false,
    lineStyle: { width: 2.5, color: COLORS[option] },
    itemStyle: { color: COLORS[option], borderColor: "#fff", borderWidth: 2 },
    emphasis: { focus: "series", lineStyle: { width: 3 } },
  }));
}

function baseLine(years: number[]) {
  return {
    animationDurationUpdate: 450,
    animationEasingUpdate: "cubicOut" as const,
    grid: { left: 56, right: 20, top: 28, bottom: 28 },
    xAxis: {
      type: "category",
      data: years,
      boundaryGap: false,
      axisLine: { lineStyle: { color: LINE } },
      axisTick: { show: false },
      axisLabel: { ...AXIS_LABEL, formatter: (value: string) => `Yr ${value}` },
    },
    yAxis: {
      type: "value",
      scale: true,
      splitNumber: 4,
      axisLabel: { ...AXIS_LABEL, formatter: formatCompactEuro },
      splitLine: { lineStyle: { color: LINE, type: [3, 4] } },
    },
    tooltip: {
      trigger: "axis",
      ...TOOLTIP_STYLE,
      axisPointer: { type: "line", lineStyle: { color: INK_3, type: [3, 3] } },
      formatter: (items: { axisValue: string; seriesName: string; value: number; color: string }[]) =>
        tooltipBox(
          `Year ${items[0].axisValue}`,
          [...items]
            .sort((a, b) => b.value - a.value)
            .map((item) => ({ color: item.color, label: item.seriesName, value: formatEuro(item.value) })),
        ),
    },
  };
}

function WealthChart({ run }: { run: PlannerRun }) {
  const option = useMemo(() => {
    const { options } = ordered(run);
    const points = run.result.years.slice(0, run.result.horizon_years);
    const breakEven = run.result.break_even_years_buy_vs_rent;
    const series = lineSeries(
      options.map((item) => item.option),
      (option) => points.map((point) => point.wealth[option] ?? 0),
    );
    if (breakEven && breakEven > 1 && breakEven <= run.result.horizon_years) {
      Object.assign(series[0], {
        markLine: {
          silent: true,
          symbol: "none",
          lineStyle: { color: INK_3, type: [4, 4], width: 1 },
          label: { formatter: "Buying passes renting", color: INK_2, fontSize: 11, position: "end", distance: 6 },
          data: [{ xAxis: String(breakEven) }],
        },
      });
    }
    return { ...baseLine(points.map((point) => point.year)), series };
  }, [run]);
  return <EChart option={option} height={260} label="Wealth of each option by year" />;
}

function CostChart({ run }: { run: PlannerRun }) {
  const option = useMemo(() => {
    const { options } = ordered(run);
    return {
      ...baseLine(run.monthly_costs.map((row) => row.year)),
      series: lineSeries(
        options.map((item) => item.option),
        (option) => run.monthly_costs.map((row) => row[option] ?? 0),
        true,
      ),
    };
  }, [run]);
  return <EChart option={option} height={260} label="Average monthly housing cost of each option by year" />;
}

function WhatIfTable({ run }: { run: PlannerRun }) {
  const { options } = ordered(run);
  const plan = Object.fromEntries(options.map((item) => [item.option, item.end_wealth])) as Record<Option, number>;
  const bestOf = (wealth: Partial<Record<Option, number>>) =>
    (Object.entries(wealth) as [Option, number][]).sort((a, b) => b[1] - a[1])[0][0];
  const planBest = bestOf(plan);
  const rows = [
    { key: "plan", label: "Your plan", wealth: plan as Partial<Record<Option, number>> },
    ...run.what_ifs.map((whatIf) => ({ key: whatIf.key, label: whatIf.label, wealth: whatIf.end_wealth })),
  ];

  return (
    <div className="overflow-x-auto px-1 pb-2">
      <p className="px-1 pb-3 text-[13px] text-ink-3">
        Wealth after {run.result.horizon_years} years if one assumption turns out differently
      </p>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-xs text-ink-3">
            <th className="pb-2 pl-1 font-normal">If</th>
            {options.map((item) => (
              <th key={item.option} className="pb-2 text-right font-normal whitespace-nowrap">
                <span className="inline-flex items-center gap-1.5">
                  <Dot color={COLORS[item.option]} size={6} />
                  {item.option === "aso" ? "ASO" : OPTION_LABELS[item.option]}
                </span>
              </th>
            ))}
            <th className="pr-1 pb-2 text-right font-normal">Best</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const best = bestOf(row.wealth);
            const changed = row.key !== "plan" && best !== planBest;
            return (
              <tr key={row.key} className={`border-t border-line ${row.key === "plan" ? "bg-well/60" : ""}`}>
                <td className={`py-2.5 pl-1 ${row.key === "plan" ? "font-medium" : "text-ink-2"}`}>{row.label}</td>
                {options.map((item) => {
                  const value = row.wealth[item.option] ?? 0;
                  const change = value - plan[item.option];
                  return (
                    <td key={item.option} className="py-2.5 text-right whitespace-nowrap">
                      <span className={item.option === best ? "font-semibold" : ""}>{formatCompactEuro(value)}</span>
                      {row.key !== "plan" && Math.abs(change) >= 50 && (
                        <span className={`block text-[11px] ${change > 0 ? "text-good" : "text-bad"}`}>
                          {change > 0 ? "+" : "−"}
                          {formatCompactEuro(Math.abs(change))}
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className="py-2.5 pr-1 text-right whitespace-nowrap">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 ${
                      changed ? "bg-ink font-medium text-paper" : ""
                    }`}
                  >
                    <Dot color={COLORS[best]} size={6} />
                    {best === "aso" ? "ASO" : OPTION_LABELS[best]}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function YearTable({ run, kind }: { run: PlannerRun; kind: "wealth" | "cost" }) {
  const { options } = ordered(run);
  const rows =
    kind === "wealth"
      ? run.result.years.slice(0, run.result.horizon_years).map((point) => ({ year: point.year, ...point.wealth }))
      : run.monthly_costs;
  return (
    <div className="max-h-[260px] overflow-auto px-2">
      <table className="num w-full text-sm">
        <thead className="sticky top-0 bg-paper text-[13px] text-ink-3">
          <tr>
            <th className="py-2 text-left font-normal">Year</th>
            {options.map((item) => (
              <th key={item.option} className="py-2 text-right font-normal">
                {OPTION_LABELS[item.option]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.year} className="border-t border-line">
              <td className="py-1.5 text-ink-2">{row.year}</td>
              {options.map((item) => (
                <td key={item.option} className="py-1.5 text-right">
                  {formatEuro((row as Partial<Record<Option, number>>)[item.option] ?? 0)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
