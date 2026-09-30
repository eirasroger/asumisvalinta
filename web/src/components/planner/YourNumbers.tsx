"use client";

import { Dot, InfoLabel, NumberField, Switch } from "@/components/ui";
import { OPTION_COLORS, type Option, type PlannerStart, ROOM_TYPES } from "@/lib/api";
import { formatEuro, formatLevel, formatPercent, formatPeriodLabel } from "@/lib/format";
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
  const size = flat.size_m2;
  const market = start.market;
  const sources = start.sources;
  const flats = ROOM_TYPES.find((type) => type.value === flat.room_type)!.flats;
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
      <Section option="rent" title="Rent">
        {line({
          key: "rent",
          label: "Monthly rent",
          suffix: "/ mo",
          about: "What you pay the landlord each month. Leases usually raise the rent with inflation, at least 2% a year.",
          source: `Non-subsidised rents, ${formatLevel(market.rent.level)}, ${formatPeriodLabel(market.rent.period)}. Statistics Finland.`,
          benchmark: {
            band: band(market.rent.range_monthly?.lower_quartile, market.rent.range_monthly?.upper_quartile),
            bandLabel: `Middle half of rents for ${flats} here`,
          },
        })}
      </Section>

      <Section option="buy" title="Buy">
        {line({
          key: "price",
          label: "Debt-free price",
          about: "The price of the flat including its share of any housing company loan (velaton hinta).",
          source: `Sales of old flats, ${formatLevel(market.price.level)}, ${formatPeriodLabel(market.price.period)}${market.price.preliminary ? ", preliminary" : ""}. Statistics Finland.`,
          benchmark: {
            band: band(market.price.range_per_m2?.lower_quartile, market.price.range_per_m2?.upper_quartile, size),
            bandLabel: `Middle half of sales of ${flats}, at ${size} m²`,
          },
        })}
        {line({
          key: "maintenance",
          label: "Maintenance charge",
          suffix: "/ mo",
          about: "Monthly charge to the housing company for running the building: heating, cleaning, insurance and upkeep (hoitovastike).",
          source: `${sources.maintenance_charge}. Statistics Finland.`,
          benchmark: {},
        })}
        {line({
          key: "capital_charges",
          label: "Renovation charges",
          suffix: "/ mo",
          about: "What owners pay the housing company for renovations such as pipes, facades and roofs (rahoitusvastike). It rises as the building ages, following what buildings of each age pay today.",
          source: `${sources.capital_charges}. Statistics Finland.`,
          benchmark: {},
        })}
        {line({
          key: "own_repairs",
          label: "Repairs inside the flat",
          suffix: "/ yr",
          about: "Repairs owners pay themselves, such as a new kitchen, bathroom or floors. Renters and right-of-occupancy residents do not pay these.",
          source: `${sources.own_repairs}. Statistics Finland.`,
          benchmark: {},
        })}
        {line({
          key: "company_loan",
          label: "Housing company loan",
          about: "The part of the debt-free price that is the flat's share of the housing company's loan. You repay it through a monthly charge.",
          source: "Enter the loan share from the sales listing.",
        })}
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
        {line({
          key: "aso_fee",
          label: "Occupancy fee",
          about: "Paid once when you move in (asumisoikeusmaksu) and paid back when you move out, raised by the building cost index. It does not follow flat prices.",
          source: `${market.aso.buildings} Asuntosäätiö buildings, ${market.aso.scope}. Their fees are ${formatPercent(market.aso.fee_to_price, 0)} of the price per m² where each stands, applied to this area.`,
          benchmark: {
            band: band(market.aso.fee_per_m2.lower_quartile, market.aso.fee_per_m2.upper_quartile, size),
            bandLabel: `Middle half of the sample, at ${size} m²`,
            higherIsWorse: false,
          },
        })}
        {line({
          key: "aso_charge",
          label: "Monthly charge",
          suffix: "/ mo",
          about: "Monthly payment for living in the flat (käyttövastike). By law it covers the building's costs, so it rises with them.",
          source: `${market.aso.buildings} Asuntosäätiö buildings, ${market.aso.scope}. Their charges are ${formatPercent(market.aso.charge_to_rent, 0)} of the market rent where each stands, applied to this area.`,
          benchmark: {
            band: band(market.aso.charge_per_m2.lower_quartile, market.aso.charge_per_m2.upper_quartile, size),
            bandLabel: `Middle half of the sample, at ${size} m²`,
          },
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
  const benchmark = field.benchmark;
  const difference = benchmark && typical > 0 ? value / typical - 1 : 0;
  const near = Math.abs(difference) < 0.05;
  const worse = benchmark?.higherIsWorse === false ? null : difference > 0;
  const tone = near || worse === null ? "text-ink-3" : worse ? "text-bad" : "text-good";

  return (
    <div className="grid grid-cols-[1fr_160px] items-center gap-x-3 gap-y-1">
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
              {near ? "In line with market" : `${difference > 0 ? "▲" : "▼"} ${Math.round(Math.abs(difference) * 100)}% vs market`}
            </span>
          )}
          <button type="button" onClick={onReset} className="text-ink-3 hover:text-ink">
            Reset
          </button>
        </div>
      )}
    </div>
  );
}

function Comparison({ value, typical, benchmark }: { value: number; typical: number; benchmark: Benchmark }) {
  const points = [value, typical, ...(benchmark.band ?? [])].filter((point) => point > 0);
  const low = Math.min(...points) * 0.9;
  const high = Math.max(...points) * 1.1;
  const at = (point: number) => `${((point - low) / (high - low)) * 100}%`;
  return (
    <div className="mt-4 border-t border-line pt-3">
      <div className="flex items-baseline justify-between text-[13px]">
        <span className="text-ink-2">Market for this flat</span>
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
            {benchmark.bandLabel}: {formatEuro(benchmark.band[0])} to {formatEuro(benchmark.band[1])}
          </p>
        </>
      )}
      {Math.abs(value - typical) >= 1 && <p className="mt-1 text-xs text-ink-3">Your number: {formatEuro(value)}</p>}
    </div>
  );
}
