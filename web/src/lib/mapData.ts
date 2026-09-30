"use client";

import { useEffect, useState } from "react";
import { api, type MapValue, type RoomType } from "@/lib/api";
import { formatCompactEuro, formatEuro, formatEuroCents, formatNumber } from "@/lib/format";

export const HELSINKI_METRO = ["091", "049", "092", "235"];

export type MapScope = "metro" | "finland";
export type MapMetric = "price" | "rent" | "ratio";

export const SCOPES: { value: MapScope; label: string; bounds: [[number, number], [number, number]] }[] = [
  { value: "metro", label: "Helsinki area", bounds: [[24.5, 60.1], [25.3, 60.4]] },
  { value: "finland", label: "Finland", bounds: [[19.3, 59.7], [31.6, 70.1]] },
];

export const METRICS: {
  value: MapMetric;
  label: string;
  unit: string;
  short: (value: number) => string;
  exact: (value: number) => string;
}[] = [
  { value: "price", label: "Price", unit: "per m²", short: formatCompactEuro, exact: (value) => `${formatEuro(value)} / m²` },
  { value: "rent", label: "Rent", unit: "per m² a month", short: formatEuroCents, exact: (value) => `${formatEuroCents(value)} / m²` },
  { value: "ratio", label: "Price-to-rent", unit: "years of rent", short: (value) => formatNumber(value), exact: (value) => `${formatNumber(value)} years` },
];

export const SEQUENTIAL = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"];

const cache = new Map<RoomType, Promise<MapValue[]>>();

export function useMapValues(roomType: RoomType) {
  const [state, setState] = useState<{ roomType: RoomType; rows: MapValue[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    if (!cache.has(roomType)) {
      cache.set(
        roomType,
        api.mapValues(roomType).catch((caught) => {
          cache.delete(roomType);
          throw caught;
        }),
      );
    }
    cache.get(roomType)!.then(
      (rows) => current && setState({ roomType, rows }),
      (caught: Error) => current && setError(caught.message),
    );
    return () => {
      current = false;
    };
  }, [roomType]);

  return { rows: state?.roomType === roomType ? state.rows : null, error };
}

export function metricValue(row: MapValue, metric: MapMetric) {
  return metric === "price" ? row.price_per_m2 : metric === "rent" ? row.rent_per_m2 : row.price_to_rent_ratio;
}

export function isEstimated(row: MapValue, metric: MapMetric) {
  if (metric === "price") return row.price_geography_level !== "postal_code";
  if (metric === "rent") return row.rent_geography_level !== "postal_code";
  return row.price_geography_level !== "postal_code" || row.rent_geography_level !== "postal_code";
}

export function inScope(row: MapValue, scope: MapScope) {
  return scope === "finland" || HELSINKI_METRO.includes(row.municipality_code);
}

/** Six cut points that split the values into seven equal-count classes. */
export function quantileCuts(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return [];
  return SEQUENTIAL.slice(1).map((_, index) => sorted[Math.floor(((index + 1) / SEQUENTIAL.length) * (sorted.length - 1))]);
}
