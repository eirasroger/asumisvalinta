"use client";

import { useState } from "react";
import { LineChart } from "@/components/LineChart";
import { PostalCodeSearch } from "@/components/PostalCodeSearch";
import { StatTile } from "@/components/StatTile";
import {
  api,
  OPTION_LABELS,
  type Option,
  type Overrides,
  type PostalArea,
  ROOM_TYPES,
  type RoomType,
  type ScenarioResponse,
} from "@/lib/api";
import { formatCompactEuro, formatEuro } from "@/lib/format";

const COLORS: Record<Option, string> = {
  buy: "var(--series-buy)",
  rent: "var(--series-rent)",
  aso: "var(--series-aso)",
};

type FieldKind = "euro" | "percent" | "number";
interface Field {
  key: keyof Overrides;
  label: string;
  kind: FieldKind;
  step?: number;
}

const FIELDS: { group: string; fields: Field[] }[] = [
  {
    group: "Market",
    fields: [
      { key: "price_per_m2", label: "Price per m² (€)", kind: "euro", step: 50 },
      { key: "price_growth", label: "Price growth per year (%)", kind: "percent", step: 0.1 },
      { key: "rent_per_m2_month", label: "Rent per m² per month (€)", kind: "euro", step: 0.1 },
      { key: "rent_growth", label: "Rent growth per year (%)", kind: "percent", step: 0.1 },
    ],
  },
  {
    group: "Mortgage",
    fields: [
      { key: "interest_rate", label: "Interest rate (%)", kind: "percent", step: 0.05 },
      { key: "rate_change_per_year", label: "Rate change per year (percentage points)", kind: "percent", step: 0.05 },
      { key: "down_payment_share", label: "Down payment (% of price)", kind: "percent", step: 1 },
      { key: "loan_term_years", label: "Loan term (years)", kind: "number", step: 1 },
    ],
  },
  {
    group: "Owning a flat",
    fields: [
      { key: "maintenance_charge_per_m2_month", label: "Maintenance charge per m² per month (€)", kind: "euro", step: 0.1 },
      { key: "renovation_reserve_per_m2_year", label: "Renovation reserve per m² per year (€)", kind: "euro", step: 5 },
    ],
  },
  {
    group: "Right of occupancy",
    fields: [
      { key: "aso_fee_per_m2", label: "Right-of-occupancy fee per m² (€)", kind: "euro", step: 10 },
      { key: "aso_charge_per_m2_month", label: "Monthly charge per m² (€)", kind: "euro", step: 0.1 },
    ],
  },
  {
    group: "Money put aside",
    fields: [{ key: "investment_return", label: "Investment return per year (%)", kind: "percent", step: 0.1 }],
  },
];

function assumptionsFrom(response: ScenarioResponse): Overrides {
  const { buy, rent, aso, investment } = response.inputs;
  const path = buy.mortgage.rate_path;
  return {
    price_per_m2: buy.price_per_m2,
    price_growth: buy.price_growth,
    rent_per_m2_month: rent.rent_per_m2_month,
    rent_growth: rent.rent_growth,
    interest_rate: path.start_rate,
    rate_path: path.kind === "custom" ? "flat" : path.kind,
    rate_change_per_year: path.change_per_year,
    down_payment_share: buy.mortgage.down_payment_share,
    loan_term_years: buy.mortgage.term_years,
    repayment: buy.mortgage.repayment,
    maintenance_charge_per_m2_month: buy.maintenance_charge_per_m2_month,
    renovation_reserve_per_m2_year: buy.renovation_reserve_per_m2_year,
    aso_fee_per_m2: aso?.fee_per_m2,
    aso_charge_per_m2_month: aso?.charge_per_m2_month,
    investment_return: investment.investment_return,
    surplus_strategy: investment.surplus_strategy,
  };
}

const toDisplay = (value: number | undefined, kind: FieldKind) =>
  value === undefined ? "" : kind === "percent" ? String(+(value * 100).toFixed(3)) : String(+value.toFixed(2));
const fromDisplay = (text: string, kind: FieldKind) =>
  text === "" ? undefined : kind === "percent" ? Number(text) / 100 : Number(text);

export default function ComparePage() {
  const [area, setArea] = useState<PostalArea | null>(null);
  const [roomType, setRoomType] = useState<RoomType>("two_room");
  const [size, setSize] = useState("55");
  const [horizon, setHorizon] = useState("5");
  const [overrides, setOverrides] = useState<Overrides>({});
  const [response, setResponse] = useState<ScenarioResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(nextOverrides: Overrides) {
    if (!area) {
      setError("Choose a postal code first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await api.scenario({
        postal_code: area.postal_code,
        room_type: roomType,
        size_m2: Number(size),
        horizon_years: Number(horizon),
        overrides: nextOverrides,
      });
      setResponse(result);
      setOverrides(assumptionsFrom(result));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const result = response?.result;
  const options = result?.options ?? [];
  const best = options.length ? options.reduce((a, b) => (b.end_wealth > a.end_wealth ? b : a)).option : null;
  const chartSeries = options.map((o) => ({ key: o.option, label: OPTION_LABELS[o.option], color: COLORS[o.option] }));
  const chartData = (result?.years ?? []).map((point) => ({ year: point.year, ...point.wealth }));

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h1 className="text-3xl font-semibold">Rent, right of occupancy or buy?</h1>
        <p className="max-w-3xl text-ink-secondary">
          Compare what each way of living in a flat leaves you with after a number of years. Prices,
          rents, charges and interest rates come from official Finnish statistics; every assumption is
          shown and can be changed.
        </p>
      </section>

      <form
        className="grid gap-4 rounded-lg border border-border bg-surface p-4 md:grid-cols-[2fr_1.3fr_1fr_1fr_auto] md:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          run({});
        }}
      >
        <label className="space-y-1 text-sm">
          <span className="text-ink-secondary">Postal code</span>
          <PostalCodeSearch value={area} onChange={setArea} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-ink-secondary">Flat</span>
          <select
            value={roomType}
            onChange={(event) => setRoomType(event.target.value as RoomType)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2"
          >
            {ROOM_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-ink-secondary">Size (m²)</span>
          <input
            type="number"
            min={10}
            max={500}
            value={size}
            onChange={(event) => setSize(event.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-ink-secondary">Years</span>
          <input
            type="number"
            min={1}
            max={30}
            value={horizon}
            onChange={(event) => setHorizon(event.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-accent px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? "Calculating…" : "Compare"}
        </button>
      </form>

      {error && <p className="text-sm text-critical">{error}</p>}

      {result && (
        <div className={loading ? "space-y-8 opacity-60" : "space-y-8"}>
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">After {result.horizon_years} years</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {options.map((option) => (
                <StatTile
                  key={option.option}
                  label={OPTION_LABELS[option.option]}
                  color={COLORS[option.option]}
                  value={formatEuro(option.end_wealth)}
                  detail={`Paid in total ${formatEuro(option.total_paid)}, of which ${formatEuro(option.upfront_payment)} up front`}
                  highlight={option.option === best ? "Most wealth" : undefined}
                />
              ))}
            </div>
            <p className="text-sm text-ink-secondary">
              Everyone starts with {formatEuro(result.initial_capital)} and spends the same each month; the
              cheaper options invest the difference.{" "}
              {result.break_even_years_buy_vs_rent
                ? `Buying catches up with renting after ${result.break_even_years_buy_vs_rent} years.`
                : "Buying does not catch up with renting within 30 years."}
              {result.break_even_years_buy_vs_aso
                ? ` It catches up with right of occupancy after ${result.break_even_years_buy_vs_aso} years.`
                : ""}
            </p>
            {result.warnings.map((warning) => (
              <p key={warning} className="text-sm text-ink-secondary">
                ⚠ {warning}
              </p>
            ))}
          </section>

          <LineChart
            title="Wealth if you stop after each year"
            subtitle="Everything turned into cash at the end of the year, after taxes and selling costs"
            data={chartData}
            xKey="year"
            series={chartSeries}
            formatY={formatCompactEuro}
            marker={{ x: result.horizon_years, label: "Your horizon" }}
          />

          <section className="space-y-4 rounded-lg border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Assumptions</h2>
              <button
                type="button"
                disabled={loading}
                onClick={() => run(overrides)}
                className="rounded-md border border-border px-4 py-1.5 text-sm disabled:opacity-60"
              >
                Recalculate
              </button>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {FIELDS.map((group) => (
                <fieldset key={group.group} className="space-y-2">
                  <legend className="mb-1 text-sm font-medium">{group.group}</legend>
                  {group.fields.map((field) => (
                    <label key={field.key} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-ink-secondary">{field.label}</span>
                      <input
                        type="number"
                        step={field.step}
                        value={toDisplay(overrides[field.key] as number | undefined, field.kind)}
                        onChange={(event) =>
                          setOverrides({ ...overrides, [field.key]: fromDisplay(event.target.value, field.kind) })
                        }
                        className="tabular w-28 rounded-md border border-border bg-surface px-2 py-1 text-right"
                      />
                    </label>
                  ))}
                </fieldset>
              ))}
              <fieldset className="space-y-2">
                <legend className="mb-1 text-sm font-medium">Choices</legend>
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-ink-secondary">Interest rate path</span>
                  <select
                    value={overrides.rate_path ?? "flat"}
                    onChange={(event) =>
                      setOverrides({ ...overrides, rate_path: event.target.value as Overrides["rate_path"] })
                    }
                    className="rounded-md border border-border bg-surface px-2 py-1"
                  >
                    <option value="flat">Flat</option>
                    <option value="rising">Rising</option>
                    <option value="falling">Falling</option>
                  </select>
                </label>
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-ink-secondary">Repayment</span>
                  <select
                    value={overrides.repayment ?? "annuity"}
                    onChange={(event) =>
                      setOverrides({ ...overrides, repayment: event.target.value as Overrides["repayment"] })
                    }
                    className="rounded-md border border-border bg-surface px-2 py-1"
                  >
                    <option value="annuity">Annuity</option>
                    <option value="equal_principal">Equal principal</option>
                  </select>
                </label>
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-ink-secondary">Money put aside</span>
                  <select
                    value={overrides.surplus_strategy ?? "invest"}
                    onChange={(event) =>
                      setOverrides({
                        ...overrides,
                        surplus_strategy: event.target.value as Overrides["surplus_strategy"],
                      })
                    }
                    className="rounded-md border border-border bg-surface px-2 py-1"
                  >
                    <option value="invest">Invested</option>
                    <option value="park">Bank account</option>
                  </select>
                </label>
              </fieldset>
            </div>
            <details className="text-sm">
              <summary className="cursor-pointer text-ink-secondary">Where the defaults come from</summary>
              <ul className="mt-2 space-y-1 text-ink-secondary">
                {Object.entries(response.sources).map(([key, source]) => (
                  <li key={key}>
                    <span className="text-ink">{key.replaceAll("_", " ")}</span>: {source}
                  </li>
                ))}
              </ul>
            </details>
          </section>
        </div>
      )}
    </div>
  );
}
