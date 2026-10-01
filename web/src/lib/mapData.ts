"use client";

import type { Feature, FeatureCollection, Geometry } from "geojson";
import { useEffect, useState } from "react";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { api, type MapTrends, type MapValue, ROOM_TYPES, type RoomType } from "@/lib/api";
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

export type Shape = Feature<Geometry, { postal_code: string; municipality_code: string }>;

/** A promise per key that is started once, kept, and retried after a failure. */
function cached<K, V>(load: (key: K) => Promise<V>) {
  const pending = new Map<K, Promise<V>>();
  const done = new Map<K, V>();
  return {
    get(key: K) {
      if (!pending.has(key)) {
        pending.set(
          key,
          load(key).then(
            (value) => {
              done.set(key, value);
              return value;
            },
            (error) => {
              pending.delete(key);
              throw error;
            },
          ),
        );
      }
      return pending.get(key)!;
    },
    peek: (key: K) => done.get(key),
  };
}

const shapeCache = cached(async () => {
  const response = await fetch("/geo/postal-areas.topo.json");
  if (!response.ok) throw new Error("The postal area map could not be loaded.");
  const topology = (await response.json()) as Topology<{ postal_areas: GeometryCollection<Shape["properties"]> }>;
  return (feature(topology, topology.objects.postal_areas) as FeatureCollection<Geometry, Shape["properties"]>).features;
});
const valueCache = cached((roomType: RoomType) => api.mapValues(roomType));
const trendCache = cached((roomType: RoomType) => api.mapTrends(roomType));

export const loadShapes = () => shapeCache.get("all");

/** Start the downloads the map needs before its code has loaded. */
export function preloadMap(roomType: RoomType) {
  loadShapes().catch(() => undefined);
  valueCache.get(roomType).catch(() => undefined);
}

/** Download what the other controls need, once the map is on screen. */
export function preloadRest(roomType: RoomType) {
  trendCache.get(roomType).catch(() => undefined);
  for (const type of ROOM_TYPES) valueCache.get(type.value).catch(() => undefined);
}

/** Values for the map; the previous room type's values stay until the new ones arrive. */
export function useMapValues(roomType: RoomType) {
  const [state, setState] = useState(() => ({ roomType, rows: valueCache.peek(roomType) ?? null }));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    valueCache.get(roomType).then(
      (rows) => current && setState({ roomType, rows }),
      (caught: Error) => current && setError(caught.message),
    );
    return () => {
      current = false;
    };
  }, [roomType]);

  return { rows: state.rows, loading: state.roomType !== roomType, error };
}

export function useMapTrends(roomType: RoomType, enabled: boolean) {
  const [state, setState] = useState<{ roomType: RoomType; trends: MapTrends } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let current = true;
    trendCache.get(roomType).then(
      (trends) => current && setState({ roomType, trends }),
      () => undefined,
    );
    return () => {
      current = false;
    };
  }, [roomType, enabled]);

  return state?.roomType === roomType ? state.trends : null;
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
