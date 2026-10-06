"use client";

import { GuideLink } from "@/components/GuideLink";
import { Dot, InfoLabel, NumberField, Switch } from "@/components/ui";
import { useI18n } from "@/i18n/I18nProvider";
import { OPTION_COLORS, type Option, type PlannerStart } from "@/lib/api";
import { formatEuro, formatPeriodLabel } from "@/lib/format";
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
  band?: [number, number] | null;
  bandLabel?: string;
  higherIsWorse?: boolean;
}

interface Field {
  key: keyof Offer;
  label: string;
  suffix?: string;
  about: string;
  source: string;
  benchmark?: Benchmark;
}

export function YourNumbers({ start, flat, offer, typical, onOffer, assumptions, onAssumptions }: Props) {
  const { t } = useI18n();
  const n = t.numbers;
  const level = (code: string) => t.levels[code] ?? code;
  const size = flat.size_m2;
  const market = start.market;
  const sources = start.sources;
  const flats = t.rooms.flats[flat.room_type];
  const band = (low: number | null | undefined, high: number | null | undefined, scale = 1): [number, number] | null =>
    low != null && high != null ? [low * scale, high * scale] : null;

  const line = (field: Field) => (
    <Line
      key={field.key}
      field={field}
      value={offerValue(offer, typical, field.key)}
      typical={typical[field.key]}
      overridden={offer[field.key] !== null}
      onChange={(next) => onOffer({ ...offer, [field.key]: next })}
      onReset={() => onOffer({ ...offer, [field.key]: null })}
    />
  );

  return (
    <div className="rounded-xl border border-line bg-paper">
      <Section option="rent" title={n.rent.title}>
        {line({
          key: "rent",
          label: n.rent.label,
          suffix: n.perMonth,
          about: n.rent.about,
          source: n.rent.source(level(market.rent.level), formatPeriodLabel(market.rent.period)),
          benchmark: {
            band: band(market.rent.range_monthly?.lower_quartile, market.rent.range_monthly?.upper_quartile),
            bandLabel: n.rent.band(flats),
          },
        })}
      </Section>

      <Section option="buy" title={n.buy.title}>
        {line({
          key: "price",
          label: n.buy.price,
          about: n.buy.priceAbout,
          source: n.buy.priceSource(level(market.price.level), formatPeriodLabel(market.price.period), sources.price_building_age),
          benchmark: {
            band: band(market.price.range_per_m2?.lower_quartile, market.price.range_per_m2?.upper_quartile, size),
            bandLabel: n.buy.priceBand(flats, size, market.price.building_age_ratio !== 1),
          },
        })}
        {line({
          key: "maintenance",
          label: n.buy.maintenance,
          suffix: n.perMonth,
          about: n.buy.maintenanceAbout,
          source: sources.maintenance_charge,
          benchmark: {},
        })}
        {line({
          key: "capital_charges",
          label: n.buy.capital,
          suffix: n.perMonth,
          about: n.buy.capitalAbout,
          source: sources.capital_charges,
          benchmark: {},
        })}
        {line({
          key: "own_repairs",
          label: n.buy.repairs,
          suffix: n.perYear,
          about: n.buy.repairsAbout,
          source: sources.own_repairs,
          benchmark: {},
        })}
        {line({
          key: "company_loan",
          label: n.buy.companyLoan,
          about: n.buy.companyLoanAbout,
          source: n.buy.companyLoanSource,
        })}
        <GuideLink slug="asunnon-ostamisen-kulut">{t.guides.links.buying}</GuideLink>
      </Section>

      <Section
        option="aso"
        title={n.aso.title}
        aside={
          <Switch
            label={n.aso.include}
            checked={assumptions.include_aso}
            onChange={(checked) => onAssumptions({ ...assumptions, include_aso: checked })}
          />
        }
        collapsed={!assumptions.include_aso}
      >
        {line({
          key: "aso_fee",
          label: n.aso.fee,
          about: n.aso.feeAbout,
          source: `${sources.aso_fee}.`,
        })}
        {line({
          key: "aso_charge",
          label: n.aso.charge,
          suffix: n.perMonth,
          about: n.aso.chargeAbout,
          source: `${sources.aso_charge}.`,
        })}
        <GuideLink slug="asumisoikeus">{t.guides.links.aso}</GuideLink>
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
  field,
  value,
  typical,
  overridden,
  onChange,
  onReset,
}: {
  field: Field;
  value: number;
  typical: number;
  overridden: boolean;
  onChange: (value: number) => void;
  onReset: () => void;
}) {
  const { t } = useI18n();
  const benchmark = field.benchmark;
  const difference = benchmark && typical > 0 ? value / typical - 1 : 0;
  const near = Math.abs(difference) < 0.05;
  const worse = benchmark?.higherIsWorse === false ? null : difference > 0;
  const tone = near || worse === null ? "text-ink-3" : worse ? "text-bad" : "text-good";

  return (
    <div className="grid grid-cols-[1fr_160px] items-center gap-x-3 gap-y-1 max-[389px]:grid-cols-[1fr_140px]">
      <InfoLabel label={field.label}>
        <p className="leading-relaxed text-ink">{field.about}</p>
        {benchmark && <Comparison value={value} typical={typical} benchmark={benchmark} />}
        <p className="mt-3 text-xs leading-relaxed text-ink-3">{field.source}</p>
      </InfoLabel>
      <NumberField label={field.label} value={value} onChange={onChange} prefix="€" suffix={field.suffix} min={0} />
      {overridden && (
        <div className="col-start-2 flex justify-end gap-2 text-xs">
          {benchmark && (
            <span className={tone}>
              {near ? t.numbers.inLine : t.numbers.versusMarket(difference > 0 ? "▲" : "▼", Math.round(Math.abs(difference) * 100))}
            </span>
          )}
          <button type="button" onClick={onReset} className="text-ink-3 hover:text-ink">
            {t.common.reset}
          </button>
        </div>
      )}
    </div>
  );
}

function Comparison({ value, typical, benchmark }: { value: number; typical: number; benchmark: Benchmark }) {
  const { t } = useI18n();
  const points = [value, typical, ...(benchmark.band ?? [])].filter((point) => point > 0);
  const low = Math.min(...points) * 0.9;
  const high = Math.max(...points) * 1.1;
  const at = (point: number) => `${((point - low) / (high - low)) * 100}%`;
  return (
    <div className="mt-4 border-t border-line pt-3">
      <div className="flex items-baseline justify-between text-[13px]">
        <span className="text-ink-2">{t.numbers.market}</span>
        <span className="font-semibold">{formatEuro(typical)}</span>
      </div>
      {benchmark.band && (
        <>
          <div className="relative mt-3 h-5" aria-hidden="true">
            <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line-strong" />
            <div
              className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-[#cde2fb]"
              style={{ left: at(benchmark.band[0]), width: `calc(${at(benchmark.band[1])} - ${at(benchmark.band[0])})` }}
            />
            <div className="absolute top-1/2 h-4 w-px -translate-y-1/2 bg-ink-3" style={{ left: at(typical) }} />
            <div
              className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-paper bg-ink shadow"
              style={{ left: at(value) }}
            />
          </div>
          <p className="mt-2 text-xs text-ink-3">
            {t.numbers.bandRange(benchmark.bandLabel ?? "", formatEuro(benchmark.band[0]), formatEuro(benchmark.band[1]))}
          </p>
        </>
      )}
      {Math.abs(value - typical) >= 1 && <p className="mt-1 text-xs text-ink-3">{t.numbers.yours(formatEuro(value))}</p>}
    </div>
  );
}
