"use client";

import { GuideLink } from "@/components/GuideLink";
import { Tabs } from "radix-ui";
import { useMemo, useState } from "react";
import { EChart, INK_2, INK_3, LINE, TOOLTIP_STYLE, tooltipBox } from "@/components/charts/EChart";
import { Dot, Money, Popover } from "@/components/ui";
import { useI18n } from "@/i18n/I18nProvider";
import type { Messages } from "@/i18n/messages";
import type { Option, OptionResult, PlannerRun } from "@/lib/api";
import { formatCompactEuro, formatEuro } from "@/lib/format";

const ORDER: Option[] = ["buy", "rent", "aso"];
const COLORS: Record<Option, string> = { buy: "#2a78d6", rent: "#eb6834", aso: "#1baf7a" };

/** Sign of each part of the end wealth; the labels are in outcome.breakdown. */
const BREAKDOWN: Record<string, 1 | -1> = {
  home_value: 1,
  selling_costs: -1,
  mortgage_left: -1,
  housing_company_loan_left: -1,
  fee_refund: 1,
  portfolio_value: 1,
  tax: -1,
};

type View = "wealth" | "cost" | "stress";

function ordered(run: PlannerRun) {
  const options = ORDER.map((option) => run.result.options.find((item) => item.option === option)).filter(
    (item): item is OptionResult => Boolean(item),
  );
  return { options, ranked: [...options].sort((a, b) => b.end_wealth - a.end_wealth) };
}


type Strategy = "park" | "invest" | "keep";

export function Outcome({ run, loading, strategy }: { run: PlannerRun; loading: boolean; strategy: Strategy }) {
  const { t } = useI18n();
  const o = t.outcome;
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
            <span className="font-semibold text-ink">{o.winner[best.option]}</span>
            {o.ahead(horizon)}
          </span>
        </p>
        <p className="mt-1 text-[56px] leading-none font-semibold tracking-[-0.03em]">
          <Money value={best.end_wealth - second.end_wealth} signed />
        </p>
        <p className="mt-2 text-[15px] text-ink-2">
          {o.moreThan(second.option)}
          {third && (
            <>
              , <span className="num font-medium text-ink">{formatEuro(best.end_wealth - third.end_wealth)}</span>
              {o.andMoreThan(third.option)}
            </>
          )}
        </p>
      </section>

      <MonthlySplit run={run} strategy={strategy} />

      <section className="relative overflow-hidden rounded-xl border border-line bg-paper">
        {loading && <div className="busy absolute inset-x-0 top-0 h-0.5 overflow-hidden" />}
        <Tabs.Root value={view} onValueChange={(next) => setView(next as View)}>
          <div className="flex items-center gap-2 border-b border-line px-5">
            <Tabs.List aria-label={o.chart} className="flex gap-5">
              {(
                [
                  ["wealth", o.tabs.wealth],
                  ["cost", o.tabs.cost],
                  ["stress", o.tabs.stress],
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
                {table ? o.showChart : o.showTable}
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
              <th className="py-2.5 pl-5 font-normal">{o.option}</th>
              <th className="py-2.5 pl-4 text-right font-normal">{o.wealthAfter(horizon)}</th>
              <th className="py-2.5 text-right font-normal max-sm:hidden">{o.monthlyFirst}</th>
              <th className="py-2.5 pr-5 pl-4 text-right font-normal">{o.upfront}</th>
            </tr>
          </thead>
          <tbody>
            {options.map((item) => (
              <tr key={item.option} className="border-t border-line">
                <td className="py-3 pl-5">
                  <span className="flex items-center gap-2.5 font-medium">
                    <Dot color={COLORS[item.option]} />
                    {t.options.label[item.option]}
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
                <td className="py-3 pr-5 pl-4 text-right">{formatEuro(item.upfront_payment)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <GuideLink slug="vuokra-vai-omistus" className="px-1">
        {t.guides.links.rentVsBuy}
      </GuideLink>
    </div>
  );
}

/** Each month every option has the same budget: the cost of the most expensive one. */
function MonthlySplit({ run, strategy }: { run: PlannerRun; strategy: Strategy }) {
  const { t } = useI18n();
  const o = t.outcome;
  const { options } = ordered(run);
  const year = run.monthly_costs[0];
  if (!year) return null;
  const costs = options.map((item) => ({ option: item.option, cost: year[item.option] ?? 0 }));
  const budget = Math.max(...costs.map((item) => item.cost));
  const costliest = costs.find((item) => item.cost === budget)!.option;

  return (
    <section className="rounded-xl border border-line bg-paper px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-[15px] font-semibold">{o.eachMonth}</h3>
        <p className="text-[13px] text-ink-3">
          {o.budget} <span className="font-medium text-ink">{formatEuro(budget)}</span>
          {o.budgetOf(costliest)}
        </p>
      </div>
      <div className="mt-3 space-y-2.5">
        {costs.map(({ option, cost }) => {
          const left = budget - cost;
          return (
            <div
              key={option}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 text-[13px] sm:grid-cols-[minmax(0,140px)_1fr_auto]"
            >
              <span className="flex items-center gap-2 truncate">
                <Dot color={COLORS[option]} />
                {t.options.label[option]}
              </span>
              <div className="flex h-2.5 overflow-hidden rounded-full bg-well max-sm:order-last max-sm:col-span-2" aria-hidden="true">
                <div style={{ width: `${(cost / budget) * 100}%`, background: COLORS[option] }} />
              </div>
              <span className="text-right sm:w-36">
                {left >= 1 ? (
                  <>
                    <span className="font-semibold">{formatEuro(left)}</span>{" "}
                    <span className="text-ink-3">{o.keptAs[strategy]}</span>
                  </>
                ) : (
                  <span className="text-ink-3">{o.nothingLeft}</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Breakdown({ item }: { item: OptionResult }) {
  const { t } = useI18n();
  const parts = Object.entries(item.breakdown).filter(([key, value]) => key in BREAKDOWN && Math.abs(value) >= 1);
  return (
    <dl className="num space-y-1.5 text-[13px]">
      {parts.map(([key, value]) => (
        <div key={key} className="flex justify-between gap-4">
          <dt className="text-ink-2">{t.outcome.breakdown[key]}</dt>
          <dd>
            {BREAKDOWN[key] < 0 ? "−" : ""}
            {formatEuro(Math.abs(value))}
          </dd>
        </div>
      ))}
      <div className="flex justify-between border-t border-line pt-1.5 font-semibold">
        <dt>{t.outcome.walkAway}</dt>
        <dd>{formatEuro(item.end_wealth)}</dd>
      </div>
    </dl>
  );
}

const AXIS_LABEL = { color: INK_3, fontSize: 12 };

function lineSeries(t: Messages, options: Option[], values: (option: Option) => number[], step = false) {
  return options.map((option) => ({
    name: t.options.label[option],
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

/** Wealth from the day of moving in (year 0) to the end of the horizon. */
function wealthPoints(run: PlannerRun) {
  return [run.result.start, ...run.result.years.slice(0, run.result.horizon_years)];
}

function yearLabel(t: Messages, year: number | string, short = false) {
  if (String(year) === "0") return t.outcome.start;
  return short ? t.outcome.yearShort(String(year)) : t.outcome.yearLong(String(year));
}

function baseLine(t: Messages, years: number[]) {
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
      axisLabel: { ...AXIS_LABEL, formatter: (value: string) => yearLabel(t, value, true) },
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
          yearLabel(t, items[0].axisValue),
          [...items]
            .sort((a, b) => b.value - a.value)
            .map((item) => ({ color: item.color, label: item.seriesName, value: formatEuro(item.value) })),
        ),
    },
  };
}

function WealthChart({ run }: { run: PlannerRun }) {
  const { t } = useI18n();
  const option = useMemo(() => {
    const { options } = ordered(run);
    const points = wealthPoints(run);
    const breakEven = run.result.break_even_years_buy_vs_rent;
    const series = lineSeries(
      t,
      options.map((item) => item.option),
      (option) => points.map((point) => point.wealth[option] ?? 0),
    );
    if (breakEven && breakEven > 1 && breakEven <= run.result.horizon_years) {
      Object.assign(series[0], {
        markLine: {
          silent: true,
          symbol: "none",
          lineStyle: { color: INK_3, type: [4, 4], width: 1 },
          label: { formatter: t.outcome.buyingPasses, color: INK_2, fontSize: 11, position: "end", distance: 6 },
          data: [{ xAxis: String(breakEven) }],
        },
      });
    }
    return { ...baseLine(t, points.map((point) => point.year)), series };
  }, [run, t]);
  return <EChart option={option} height={260} label={t.outcome.wealthChart} />;
}

function CostChart({ run }: { run: PlannerRun }) {
  const { t } = useI18n();
  const option = useMemo(() => {
    const { options } = ordered(run);
    const series = lineSeries(
      t,
      options.map((item) => item.option),
      (option) => run.monthly_costs.map((row) => row[option] ?? 0),
      true,
    );
    return { ...baseLine(t, run.monthly_costs.map((row) => row.year)), series };
  }, [run, t]);
  return <EChart option={option} height={260} label={t.outcome.costChart} />;
}

function WhatIfTable({ run }: { run: PlannerRun }) {
  const { t } = useI18n();
  const o = t.outcome;
  const { options } = ordered(run);
  const plan = Object.fromEntries(options.map((item) => [item.option, item.end_wealth])) as Record<Option, number>;
  const bestOf = (wealth: Partial<Record<Option, number>>) =>
    (Object.entries(wealth) as [Option, number][]).sort((a, b) => b[1] - a[1])[0][0];
  const planBest = bestOf(plan);
  const rows = [
    { key: "plan", label: o.yourPlan, wealth: plan as Partial<Record<Option, number>> },
    ...run.what_ifs.map((whatIf) => ({ key: whatIf.key, label: whatIf.label, wealth: whatIf.end_wealth })),
  ];

  return (
    <div className="overflow-x-auto px-1 pb-2">
      <p className="px-1 pb-3 text-[13px] text-ink-3">
        {o.whatIfIntro(run.result.horizon_years)}
      </p>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-xs text-ink-3">
            <th className="pb-2 pl-1 font-normal">{o.whatIfColumn}</th>
            {options.map((item) => (
              <th key={item.option} className="pb-2 text-right font-normal whitespace-nowrap">
                <span className="inline-flex items-center gap-1.5">
                  <Dot color={COLORS[item.option]} size={6} />
                  {t.options.short[item.option]}
                </span>
              </th>
            ))}
            <th className="pr-1 pb-2 text-right font-normal">{o.best}</th>
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
                    {t.options.short[best]}
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
  const { t } = useI18n();
  const { options } = ordered(run);
  const rows =
    kind === "wealth"
      ? wealthPoints(run).map((point) => ({ year: point.year, ...point.wealth }))
      : run.monthly_costs;
  return (
    <div className="max-h-[260px] overflow-auto px-2">
      <table className="num w-full text-sm">
        <thead className="sticky top-0 bg-paper text-[13px] text-ink-3">
          <tr>
            <th className="py-2 text-left font-normal">{t.outcome.yearColumn}</th>
            {options.map((item) => (
              <th key={item.option} className="py-2 text-right font-normal">
                {t.options.label[item.option]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.year} className="border-t border-line">
              <td className="py-1.5 text-ink-2">{row.year === 0 ? yearLabel(t, 0) : row.year}</td>
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
