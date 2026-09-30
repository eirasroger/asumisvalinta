"use client";

import { Dot, NumberField, Popover, Switch } from "@/components/ui";
import { OPTION_COLORS, type Option, type PlannerStart, ROOM_TYPES } from "@/lib/api";
import { formatEuro, formatLevel, formatPeriodLabel } from "@/lib/format";
import { type Assumptions, type Flat, type Offer, offerValue, type Typical } from "@/lib/planner";

interface Props {
  start: PlannerStart;
  flat: Flat;
  offer: Offer;
  typical: Typical;
  onOffer: (offer: Offer) => void;
  assumptions: Assumptions;
  onAssumptions: (assumptions: Assumptions) => void;
}

interface Benchmark {
  typical: number;
  band?: [number, number] | null;
  bandLabel?: string;
  source: string;
  higherIsWorse?: boolean;
}

export function YourNumbers({ start, flat, offer, typical, onOffer, assumptions, onAssumptions }: Props) {
  const size = flat.size_m2;
  const market = start.market;
  const rooms = ROOM_TYPES.find((type) => type.value === flat.room_type)!.flats;
  const band = (low: number | null | undefined, high: number | null | undefined, scale = 1): [number, number] | null =>
    low != null && high != null ? [low * scale, high * scale] : null;

  const row = (key: keyof Offer, label: string, suffix: string | undefined, benchmark?: Benchmark) => (
    <Line
      label={label}
      value={offerValue(offer, typical, key)}
      suffix={suffix}
      onChange={(next) => onOffer({ ...offer, [key]: next })}
      overridden={offer[key] !== null}
      onReset={() => onOffer({ ...offer, [key]: null })}
      benchmark={benchmark}
    />
  );

  return (
    <div className="rounded-xl border border-line bg-paper">
      <Section option="rent" title="Rent">
        {row("rent", "Monthly rent", "/ mo", {
          typical: typical.rent,
          band: band(market.rent.range_monthly?.lower_quartile, market.rent.range_monthly?.upper_quartile),
          bandLabel: `Middle half of rents for ${rooms} here`,
          source: `Non-subsidised rents, ${formatLevel(market.rent.level)}, ${formatPeriodLabel(market.rent.period)}. Statistics Finland.`,
        })}
      </Section>

      <Section option="buy" title="Buy">
        {row("price", "Debt-free price", undefined, {
          typical: typical.price,
          band: band(market.price.range_per_m2?.lower_quartile, market.price.range_per_m2?.upper_quartile, size),
          bandLabel: `Middle half of sales of ${rooms}, at ${size} m²`,
          source: `Old flats, ${formatLevel(market.price.level)}, ${formatPeriodLabel(market.price.period)}. Statistics Finland.`,
        })}
        {row("maintenance", "Maintenance charge", "/ mo", {
          typical: typical.maintenance,
          source: start.sources.maintenance_charge ?? "Housing company finances. Statistics Finland.",
        })}
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-1 py-1 text-[13px] text-ink-3 select-none hover:text-ink">
            <svg className="transition-transform group-open:rotate-90" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <path d="m3.5 2 3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            Loan share and repairs
          </summary>
          <div className="space-y-3 pt-2">
            {row("company_loan", "Housing company loan", undefined)}
            {row("renovation", "Own repairs", "/ yr")}
          </div>
        </details>
      </Section>

      <Section
        option="aso"
        title="Right of occupancy"
        aside={
          <Switch
            label="Include right of occupancy"
            checked={assumptions.include_aso}
            onChange={(checked) => onAssumptions({ ...assumptions, include_aso: checked })}
          />
        }
        collapsed={!assumptions.include_aso}
      >
        {row("aso_fee", "Occupancy fee", undefined, {
          typical: typical.aso_fee,
          band: band(market.aso.fee_per_m2.lower_quartile, market.aso.fee_per_m2.upper_quartile, size),
          bandLabel: `Middle half of ${market.aso.buildings} buildings, at ${size} m²`,
          source: `Asuntosäätiö listings: ${market.aso.scope}. The fee is refunded when you move out.`,
          higherIsWorse: false,
        })}
        {row("aso_charge", "Monthly charge", "/ mo", {
          typical: typical.aso_charge,
          band: band(market.aso.charge_per_m2.lower_quartile, market.aso.charge_per_m2.upper_quartile, size),
          bandLabel: `Middle half of ${market.aso.buildings} buildings, at ${size} m²`,
          source: `Asuntosäätiö listings: ${market.aso.scope}.`,
        })}
      </Section>
    </div>
  );
}

function Section({
  option,
  title,
  aside,
  collapsed,
  children,
}: {
  option: Option;
  title: string;
  aside?: React.ReactNode;
  collapsed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-line px-5 py-4 last:border-b-0">
      <header className="flex items-center gap-2.5">
        <Dot color={OPTION_COLORS[option]} />
        <h2 className={`mr-auto text-[15px] font-semibold ${collapsed ? "text-ink-3" : ""}`}>{title}</h2>
        {aside}
      </header>
      {!collapsed && <div className="mt-3 space-y-3">{children}</div>}
    </section>
  );
}

function Line({
  label,
  value,
  suffix,
  onChange,
  overridden,
  onReset,
  benchmark,
}: {
  label: string;
  value: number;
  suffix?: string;
  onChange: (value: number) => void;
  overridden: boolean;
  onReset: () => void;
  benchmark?: Benchmark;
}) {
  const difference = benchmark && benchmark.typical > 0 ? value / benchmark.typical - 1 : 0;
  const near = Math.abs(difference) < 0.05;
  const worse = benchmark?.higherIsWorse === false ? null : difference > 0;
  const tone = near || worse === null ? "text-ink-3" : worse ? "text-bad" : "text-good";

  return (
    <div className="grid grid-cols-[1fr_160px] items-center gap-x-3 gap-y-1">
      {benchmark ? (
        <Popover
          align="start"
          trigger={
            <button
              type="button"
              className="justify-self-start text-left text-sm text-ink-2 underline decoration-line-strong decoration-dotted underline-offset-4 hover:text-ink hover:decoration-ink-3"
            >
              {label}
            </button>
          }
        >
          <RangeBar value={value} benchmark={benchmark} />
          <p className="mt-3 text-xs leading-relaxed text-ink-3">{benchmark.source}</p>
          {overridden && (
            <button
              type="button"
              onClick={onReset}
              className="mt-3 h-8 w-full rounded-lg border border-line text-[13px] font-medium hover:bg-well"
            >
              Use market value {formatEuro(benchmark.typical)}
            </button>
          )}
        </Popover>
      ) : (
        <span className="text-sm text-ink-2">{label}</span>
      )}
      <NumberField label={label} value={value} onChange={onChange} prefix="€" suffix={suffix} min={0} />
      {overridden && (
        <div className="col-start-2 flex justify-end gap-2 text-xs">
          {benchmark && (
            <span className={tone}>
              {near ? "In line with market" : `${difference > 0 ? "▲" : "▼"} ${Math.round(Math.abs(difference) * 100)}% vs market`}
            </span>
          )}
          <button type="button" onClick={onReset} className="text-ink-3 hover:text-ink" aria-label={`Reset ${label}`}>
            Reset
          </button>
        </div>
      )}
    </div>
  );
}

function RangeBar({ value, benchmark }: { value: number; benchmark: Benchmark }) {
  const points = [value, benchmark.typical, ...(benchmark.band ?? [])].filter((point) => point > 0);
  const low = Math.min(...points) * 0.9;
  const high = Math.max(...points) * 1.1;
  const at = (point: number) => `${((point - low) / (high - low)) * 100}%`;
  return (
    <div>
      <div className="flex items-baseline justify-between text-[13px]">
        <span className="text-ink-2">Market for this flat</span>
        <span className="num font-semibold">{formatEuro(benchmark.typical)}</span>
      </div>
      <div className="relative mt-3 h-5" aria-hidden="true">
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line-strong" />
        {benchmark.band && (
          <div
            className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-[#cde2fb]"
            style={{ left: at(benchmark.band[0]), width: `calc(${at(benchmark.band[1])} - ${at(benchmark.band[0])})` }}
          />
        )}
        <div className="absolute top-1/2 h-4 w-px -translate-y-1/2 bg-ink-3" style={{ left: at(benchmark.typical) }} />
        <div
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-paper bg-ink shadow"
          style={{ left: at(value) }}
        />
      </div>
      {benchmark.band && (
        <p className="num mt-2 text-xs text-ink-3">
          {benchmark.bandLabel}: {formatEuro(benchmark.band[0])} to {formatEuro(benchmark.band[1])}
        </p>
      )}
      <p className="num mt-1 text-xs text-ink-3">Your number: {formatEuro(value)}</p>
    </div>
  );
}
