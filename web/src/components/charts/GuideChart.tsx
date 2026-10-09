"use client";

import type { EChartsCoreOption } from "echarts/core";
import { useEffect, useMemo, useState } from "react";
import { EChart, INK_3, LINE, TOOLTIP_STYLE, tooltipBox } from "@/components/charts/EChart";
import { useI18n } from "@/i18n/I18nProvider";
import { api, type SeriesPoint } from "@/lib/api";
import examples from "@/lib/guideCharts.json";

const BLUE = "#2a78d6";
const DARK = "#184f95";
const LIGHT = "#6da7ec";
const HEIGHT = 240;
const AVERAGE_RATE = 3.24;

/** Average rate on new housing loans, monthly from 2015, with the latest value as the headline. */
function MortgageRates() {
  const { t, locale } = useI18n();
  const text = t.guides.charts.mortgageRates;
  const [rows, setRows] = useState<SeriesPoint[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api.rates().then(setRows, () => setFailed(true));
  }, []);

  const points = useMemo(
    () =>
      (rows ?? [])
        .filter((row) => typeof row.new_mortgage_rate === "number")
        .map((row) => [row.period, row.new_mortgage_rate as number] as const),
    [rows],
  );

  const { rate, signed, month } = useMemo(() => {
    const tag = locale === "fi" ? "fi-FI" : "en-GB";
    return {
      rate: new Intl.NumberFormat(tag, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      signed: new Intl.NumberFormat(tag, { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: "always" }),
      month: new Intl.DateTimeFormat(tag, { month: "long", year: "numeric" }),
    };
  }, [locale]);

  const option = useMemo<EChartsCoreOption>(
    () => ({
      animationDuration: 900,
      animationEasing: "cubicOut",
      grid: { left: 4, right: 8, top: 12, bottom: 4, containLabel: true },
      tooltip: {
        trigger: "axis",
        ...TOOLTIP_STYLE,
        axisPointer: { type: "line", lineStyle: { color: INK_3, type: "dashed" } },
        formatter: (items: { value: [string, number] }[]) => {
          const [period, value] = items[0].value;
          return tooltipBox(month.format(new Date(period)), [{ color: BLUE, label: text.title, value: `${rate.format(value)} %` }]);
        },
      },
      xAxis: {
        type: "time",
        axisTick: { show: false },
        axisLine: { lineStyle: { color: LINE } },
        splitLine: { show: false },
        axisLabel: { color: INK_3, fontSize: 11, formatter: "{yyyy}", hideOverlap: true },
      },
      yAxis: {
        type: "value",
        min: 0,
        splitNumber: 4,
        splitLine: { lineStyle: { color: LINE, type: "dashed" } },
        axisLabel: { color: INK_3, fontSize: 11, formatter: (value: number) => `${value} %` },
      },
      series: [
        {
          type: "line",
          name: text.title,
          data: points,
          showSymbol: false,
          symbolSize: 8,
          lineStyle: { width: 2, color: BLUE },
          itemStyle: { color: BLUE, borderColor: "#ffffff", borderWidth: 2 },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: `${BLUE}2e` },
                { offset: 1, color: `${BLUE}00` },
              ],
            },
          },
        },
      ],
    }),
    [points, rate, month, text.title],
  );

  if (failed) return null;

  const latest = points.at(-1);
  const yearAgo = points.at(-13);

  return (
    <figure className="my-10 rounded-[20px] border border-line bg-paper p-5 shadow-float sm:p-6">
      <figcaption>
        <p className="text-[13px] font-medium text-ink-2">
          {text.title} <span className="text-ink-3">· {text.area}</span>
        </p>
        {latest ? (
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="num text-[36px] leading-none font-semibold tracking-[-0.02em] text-ink sm:text-[40px]">
              {rate.format(latest[1])} %
            </span>
            <span className="text-sm text-ink-3">{month.format(new Date(latest[0]))}</span>
            {yearAgo && (
              <span className="num rounded-full bg-frost px-2.5 py-1 text-xs font-medium text-ink-2">
                {text.change(signed.format(latest[1] - yearAgo[1]))}
              </span>
            )}
          </div>
        ) : (
          <div className="bone mt-2 h-10 w-40" />
        )}
      </figcaption>
      <div className="mt-5">
        {rows ? (
          <EChart option={option} height={HEIGHT} label={text.title} />
        ) : (
          <div className="skeleton bone" style={{ height: HEIGHT }} />
        )}
      </div>
      <p className="mt-3 text-[11px] text-ink-3">{text.source}</p>
    </figure>
  );
}

function useFormats() {
  const { locale } = useI18n();
  return useMemo(() => {
    const tag = locale === "fi" ? "fi-FI" : "en-GB";
    return {
      euro: new Intl.NumberFormat(tag, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }),
      rate: new Intl.NumberFormat(tag, { maximumFractionDigits: 2 }),
    };
  }, [locale]);
}

function Card({ title, subtitle, legend, note, children }: {
  title: string;
  subtitle?: string;
  legend?: { color: string; label: string }[];
  note: string;
  children: React.ReactNode;
}) {
  return (
    <figure className="my-10 rounded-[20px] border border-line bg-paper p-5 shadow-float sm:p-6">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <p className="text-[15px] font-semibold text-ink">
          {title}
          {subtitle && <span className="block text-[13px] font-normal text-ink-3">{subtitle}</span>}
        </p>
        {legend && (
          <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
            {legend.map((item) => (
              <span key={item.label} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full" style={{ background: item.color }} />
                {item.label}
              </span>
            ))}
          </span>
        )}
      </figcaption>
      {children}
      <p className="mt-4 text-[11px] text-ink-3">{note}</p>
    </figure>
  );
}

const PAYMENT_LINES = [
  { years: 25, color: LIGHT, values: examples.payment_by_rate.terms["25"] },
  { years: 40, color: DARK, values: examples.payment_by_rate.terms["40"] },
];

/** Monthly payment of the guide's example loan across interest rates, for two loan terms. */
function PaymentByRate() {
  const { t } = useI18n();
  const text = t.guides.charts.paymentByRate;
  const { euro, rate } = useFormats();
  const { rates } = examples.payment_by_rate;

  const option = useMemo<EChartsCoreOption>(
    () => ({
      animationDuration: 900,
      animationEasing: "cubicOut",
      grid: { left: 4, right: 8, top: 24, bottom: 4, containLabel: true },
      tooltip: {
        trigger: "axis",
        ...TOOLTIP_STYLE,
        axisPointer: { type: "line", lineStyle: { color: INK_3, type: "dashed" } },
        formatter: (items: { value: [number, number]; color: string; seriesName: string }[]) =>
          tooltipBox(
            `${rate.format(items[0].value[0])} %`,
            items.map((item) => ({ color: item.color, label: item.seriesName, value: euro.format(item.value[1]) })),
          ),
      },
      xAxis: {
        type: "value",
        min: rates[0],
        max: rates.at(-1),
        interval: 1,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: LINE } },
        splitLine: { show: false },
        axisLabel: { color: INK_3, fontSize: 11, formatter: (value: number) => `${rate.format(value)} %` },
      },
      yAxis: {
        type: "value",
        splitNumber: 4,
        splitLine: { lineStyle: { color: LINE, type: "dashed" } },
        axisLabel: { color: INK_3, fontSize: 11, formatter: (value: number) => euro.format(value) },
      },
      series: PAYMENT_LINES.map((line, index) => ({
        type: "line",
        name: text.term(line.years),
        data: rates.map((value, step) => [value, line.values[step]]),
        showSymbol: false,
        symbolSize: 8,
        lineStyle: { width: 2, color: line.color },
        itemStyle: { color: line.color, borderColor: "#ffffff", borderWidth: 2 },
        markLine:
          index === 0
            ? {
                symbol: "none",
                silent: true,
                data: [{ xAxis: AVERAGE_RATE }],
                lineStyle: { color: INK_3, type: "dashed", width: 1 },
                label: { formatter: text.marker, position: "end", color: INK_3, fontSize: 11 },
              }
            : undefined,
      })),
    }),
    [euro, rate, rates, text],
  );

  return (
    <Card
      title={text.title}
      subtitle={text.subtitle}
      legend={PAYMENT_LINES.map((line) => ({ color: line.color, label: text.term(line.years) }))}
      note={text.note}
    >
      <div className="mt-4">
        <EChart option={option} height={HEIGHT} label={text.title} />
      </div>
    </Card>
  );
}

/** Two flats at the same debt-free price: how the price splits and what the finance charge costs. */
function CompanyLoan() {
  const { t } = useI18n();
  const text = t.guides.charts.companyLoan;
  const { euro, rate } = useFormats();
  const { flats, years } = examples.company_loan;

  return (
    <Card
      title={text.title}
      legend={[
        { color: DARK, label: text.sellingPrice },
        { color: LIGHT, label: text.loanShare },
      ]}
      note={text.note(`${rate.format(examples.company_loan.rate)} %`, years)}
    >
      {flats.map((flat) => (
        <div key={flat.name} className="mt-6">
          <p className="text-sm font-semibold text-ink">{text.flat(flat.name)}</p>
          <div className="mt-2 flex h-8 gap-[2px]" role="img" aria-label={`${text.sellingPrice} ${euro.format(flat.selling_price)}, ${text.loanShare} ${euro.format(flat.loan_share)}`}>
            <div className="rounded-l-md" style={{ flex: flat.selling_price, background: DARK }} />
            <div className="rounded-r-md" style={{ flex: flat.loan_share, background: LIGHT }} />
          </div>
          <div className="num mt-1.5 flex justify-between gap-4 text-xs text-ink-2">
            <span>{text.sellingPrice} {euro.format(flat.selling_price)}</span>
            <span>{text.loanShare} {euro.format(flat.loan_share)}</span>
          </div>
          <p className="num mt-2 text-sm text-ink">
            <span className="font-semibold">{text.charge(euro.format(flat.monthly_charge))}</span>
            <span className="text-ink-3"> · {text.interest(euro.format(flat.interest), years)}</span>
          </p>
        </div>
      ))}
    </Card>
  );
}

const CHARTS: Record<string, () => React.ReactNode> = {
  "mortgage-rates": MortgageRates,
  "payment-by-rate": PaymentByRate,
  "company-loan": CompanyLoan,
};

/** A chart placed in a guide with a ```chart block naming it. */
export function GuideChart({ name }: { name: string }) {
  const Chart = CHARTS[name];
  return Chart ? <Chart /> : null;
}
