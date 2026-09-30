"use client";

import { useEffect, useState } from "react";
import { LineChart } from "@/components/LineChart";
import { PostalCodeSearch } from "@/components/PostalCodeSearch";
import {
  api,
  type Market,
  type MarketHistory,
  type PostalArea,
  ROOM_TYPES,
  type RoomType,
  type SeriesPoint,
} from "@/lib/api";
import { formatEuro, formatEuroCents, formatLevel, formatNumber, formatPercent, formatQuarter } from "@/lib/format";

const roomLabel = (value: RoomType) => ROOM_TYPES.find((type) => type.value === value)?.label ?? value;

export default function MarketPage() {
  const [area, setArea] = useState<PostalArea | null>(null);
  const [roomType, setRoomType] = useState<RoomType>("two_room");
  const [market, setMarket] = useState<Market | null>(null);
  const [history, setHistory] = useState<MarketHistory | null>(null);
  const [rates, setRates] = useState<SeriesPoint[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.rates().then(setRates).catch(() => setRates([]));
  }, []);

  function load(nextArea: PostalArea | null, nextRoomType: RoomType) {
    setArea(nextArea);
    setRoomType(nextRoomType);
    if (!nextArea) return;
    setError(null);
    Promise.all([api.market(nextArea.postal_code), api.marketHistory(nextArea.postal_code, nextRoomType)])
      .then(([levels, series]) => {
        setMarket(levels);
        setHistory(series);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Something went wrong."));
  }

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h1 className="text-3xl font-semibold">Market explorer</h1>
        <p className="max-w-3xl text-ink-secondary">
          Prices of old flats in blocks of flats, free-market rents and housing company charges by
          postal code. When a postal code has no published figure, the value comes from the nearest
          larger area, and the table says which.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
        <PostalCodeSearch value={area} onChange={(next) => load(next, roomType)} />
        <select
          value={roomType}
          onChange={(event) => load(area, event.target.value as RoomType)}
          aria-label="Room type for the history charts"
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
        >
          {ROOM_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-critical">{error}</p>}

      {market && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">
            {market.postal_area.postal_code} {market.postal_area.postal_area_name},{" "}
            {market.postal_area.municipality_name}
          </h2>
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="tabular w-full text-sm">
              <thead className="text-left text-ink-secondary">
                <tr>
                  <th className="p-3 font-medium">Flat</th>
                  <th className="p-3 font-medium">Price per m²</th>
                  <th className="p-3 font-medium">Rent per m² per month</th>
                  <th className="p-3 font-medium">Maintenance charge</th>
                  <th className="p-3 font-medium">Price-to-rent</th>
                  <th className="p-3 font-medium">Gross yield</th>
                </tr>
              </thead>
              <tbody>
                {market.levels.map((level) => (
                  <tr key={level.room_type} className="border-t border-border align-top">
                    <td className="p-3">{roomLabel(level.room_type)}</td>
                    <td className="p-3">
                      {formatEuro(level.price_per_m2)}
                      <span className="block text-xs text-ink-muted">
                        {formatLevel(level.price_geography_level)}, {level.price_period_label}
                        {level.price_is_preliminary ? ", preliminary" : ""}
                      </span>
                    </td>
                    <td className="p-3">
                      {formatEuroCents(level.rent_per_m2)}
                      <span className="block text-xs text-ink-muted">
                        {formatLevel(level.rent_geography_level)}, {level.rent_period_label},{" "}
                        {level.rent_basis === "new_contracts" ? "new agreements" : "all agreements"}
                      </span>
                    </td>
                    <td className="p-3">{formatEuroCents(level.maintenance_charge_per_m2)}</td>
                    <td className="p-3">
                      {level.price_to_rent_ratio !== null ? `${formatNumber(level.price_to_rent_ratio)} years` : "–"}
                    </td>
                    <td className="p-3">
                      {level.gross_rental_yield !== null ? formatPercent(level.gross_rental_yield / 100) : "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {history && (
        <div className="grid gap-6 lg:grid-cols-2">
          <LineChart
            title={`Price per m², ${roomLabel(roomType).toLowerCase()}`}
            subtitle={`Postal code ${area?.postal_code}, blocks of flats, yearly statistics`}
            data={history.prices}
            xKey="period"
            series={[{ key: "avg_price_per_m2_annual", label: "Price per m²", color: "var(--series-buy)" }]}
            formatX={(value) => String(value).slice(0, 4)}
            formatY={formatEuro}
          />
          <LineChart
            title={`Rent per m² per month, ${roomLabel(roomType).toLowerCase()}`}
            subtitle={`Rent area ${history.rent_area.code}, free-market rents from 2025`}
            data={history.rents}
            xKey="period"
            series={[
              { key: "avg_rent_per_m2_new_contracts", label: "New agreements", color: "var(--series-buy)" },
              { key: "avg_rent_per_m2", label: "All agreements", color: "var(--series-rent)" },
            ]}
            formatX={(value) => formatQuarter(String(value))}
            formatY={formatEuroCents}
          />
        </div>
      )}

      {rates.length > 0 && (
        <LineChart
          title="Interest rates on new housing loans in Finland"
          subtitle="Percent per year, monthly averages. Source: ECB statistics"
          data={rates}
          xKey="period"
          series={[
            { key: "new_mortgage_rate_variable", label: "Variable or fixed up to 1 year", color: "var(--series-buy)" },
            { key: "new_mortgage_rate_fixed_1_to_5y", label: "Fixed 1 to 5 years", color: "var(--series-rent)" },
            { key: "new_mortgage_rate_fixed_over_10y", label: "Fixed over 10 years", color: "var(--series-aso)" },
          ]}
          formatX={(value) => String(value).slice(0, 7)}
          formatY={(value) => `${value.toFixed(2)} %`}
        />
      )}
    </div>
  );
}
