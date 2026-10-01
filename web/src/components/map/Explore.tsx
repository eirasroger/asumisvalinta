"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import NumberFlow from "@number-flow/react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { EChart, INK_3, LINE } from "@/components/charts/EChart";
import type { HoverInfo, Padding } from "@/components/map/AreaMap";
import { PostalCodeSearch } from "@/components/PostalCodeSearch";
import { track } from "@/lib/analytics";
import { Segmented } from "@/components/ui";
import { type MapTrends, type MapValue, ROOM_TYPES, type RoomType } from "@/lib/api";
import { formatEuro } from "@/lib/format";
import {
  inScope,
  isEstimated,
  loadShapes,
  type MapMetric,
  type MapScope,
  METRICS,
  metricValue,
  quantileCuts,
  SCOPES,
  preloadMap,
  preloadRest,
  SEQUENTIAL,
  useMapTrends,
  useMapValues,
} from "@/lib/mapData";

const AreaMap = dynamic(() => import("@/components/map/AreaMap").then((module) => module.AreaMap), { ssr: false });

const PANEL = 380;
const PHONE = "(max-width: 639px)";

function usePhone() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(PHONE);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(PHONE).matches,
    () => false,
  );
}
const REVEAL_LIMIT_MS = 10_000;

export function Explore() {
  const router = useRouter();
  const params = useSearchParams();
  const [selected, setSelected] = useState<string | null>(() => {
    const postal = params.get("postal");
    return postal && /^\d{5}$/.test(postal) ? postal : null;
  });
  const [roomType, setRoomType] = useState<RoomType>((params.get("rooms") as RoomType) || "two_room");
  const [metric, setMetric] = useState<MapMetric>("price");
  const [scope, setScope] = useState<MapScope>("metro");
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [shown, setShown] = useState(false);
  const [shapes, setShapes] = useState(false);
  const [shapesError, setShapesError] = useState<string | null>(null);
  const { rows, loading, error } = useMapValues(roomType);
  const trends = useMapTrends(roomType, shown);
  const info = METRICS.find((item) => item.value === metric)!;
  const row = useMemo(() => rows?.find((item) => item.postal_code === selected), [rows, selected]);
  const [firstRoomType] = useState(roomType);
  const phone = usePhone();
  // Keep the areas clear of the controls: on a phone the panel and legend sit at the bottom.
  const padding = useMemo<Padding>(
    () =>
      phone
        ? { top: 190, right: 0, bottom: selected ? 300 : 170, left: 0 }
        : { top: 0, right: selected ? PANEL + 16 : 0, bottom: 0, left: 0 },
    [phone, selected],
  );

  useEffect(() => {
    preloadMap(firstRoomType);
    loadShapes().then(
      () => setShapes(true),
      (caught: Error) => setShapesError(caught.message),
    );
  }, [firstRoomType]);

  // Never keep the loader up if the map cannot draw, for example without WebGL.
  const dataReady = shapes && rows !== null;
  useEffect(() => {
    if (!dataReady) return;
    const timer = setTimeout(() => setShown(true), REVEAL_LIMIT_MS);
    return () => clearTimeout(timer);
  }, [dataReady]);

  useEffect(() => {
    if (shown) preloadRest(roomType);
  }, [shown, roomType]);

  const cuts = useMemo(
    () =>
      quantileCuts(
        (rows ?? [])
          .filter((row) => inScope(row, scope))
          .map((row) => metricValue(row, metric))
          .filter((value): value is number => typeof value === "number"),
      ),
    [rows, scope, metric],
  );

  function select(code: string | null, source?: "map" | "search") {
    if (code && source) track({ type: "area", postal_code: code, room_type: roomType, source, metric });
    setSelected(code);
    router.replace(code ? `/?postal=${code}&rooms=${roomType}` : "/", { scroll: false });
  }

  return (
    <div className="relative h-[calc(100dvh-57px)] overflow-hidden bg-well">
      <AreaMap
        rows={rows}
        metric={metric}
        cuts={cuts}
        scope={scope}
        selected={selected}
        onSelect={(code) => select(code, "map")}
        onHover={setHover}
        onReady={() => setShown(true)}
        padding={padding}
      />

      <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex flex-col gap-2 sm:inset-x-4 sm:top-4 sm:w-[360px]">
        <div className="pointer-events-auto space-y-2.5 rounded-xl bg-paper p-2.5 shadow-float">
          <PostalCodeSearch onChange={(area) => select(area.postal_code, "search")} />
          <Segmented
            label="Colour areas by"
            size="sm"
            className="w-full"
            value={metric}
            onChange={setMetric}
            options={METRICS.map((item) => ({ value: item.value, label: item.label }))}
          />
          <Segmented
            label="Rooms"
            size="sm"
            className="w-full"
            value={roomType}
            onChange={setRoomType}
            options={ROOM_TYPES.map((type) => ({ value: type.value, label: type.short }))}
          />
        </div>
        {loading && shown && <div className="busy relative h-0.5 overflow-hidden rounded-full bg-line" role="status" aria-label="Loading" />}
      </div>

      {cuts.length > 0 && (
        <div className={`absolute bottom-3 left-3 z-10 rounded-xl bg-paper px-3.5 py-3 shadow-float sm:bottom-4 sm:left-4 ${selected ? "max-sm:hidden" : ""}`}>
          <Segmented
            label="Map view"
            size="sm"
            className="mb-3 w-full"
            value={scope}
            onChange={setScope}
            options={SCOPES.map((item) => ({ value: item.value, label: item.label }))}
          />
          <p className="mb-2 text-[13px] font-medium">
            {info.label} <span className="font-normal text-ink-3">{info.unit}</span>
          </p>
          <div className="flex pr-3">
            {SEQUENTIAL.map((color, index) => (
              <div key={color} className="w-10">
                <div
                  className={`h-2 ${index === 0 ? "rounded-l-full" : ""} ${index === SEQUENTIAL.length - 1 ? "rounded-r-full" : ""}`}
                  style={{ background: color }}
                />
                {index > 0 && <span className="num -ml-3.5 block pt-1 text-[11px] text-ink-3">{info.short(cuts[index - 1])}</span>}
              </div>
            ))}
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-3">
            <span className="inline-block h-2.5 w-3.5 rounded-sm bg-[repeating-linear-gradient(45deg,#3987e5_0_2px,#b9d4f5_2px_4px)]" />
            Hatched: figure from a larger area
          </p>
          <p className="mt-1 text-[11px] text-ink-3">Source: Statistics Finland (CC BY 4.0)</p>
        </div>
      )}

      {hover && (
        <div
          className="pointer-events-none absolute z-20 rounded-lg bg-paper px-3 py-2 shadow-float [@media(hover:none)]:hidden"
          style={{ left: hover.x + 14, top: hover.y + 14 }}
        >
          <p className="text-[13px]">
            <span className="font-medium">{hover.name}</span> <span className="num text-ink-3">{hover.postal_code}</span>
          </p>
          <p className="num text-[15px] font-semibold">{hover.value !== null ? info.exact(hover.value) : "No data"}</p>
        </div>
      )}

      {selected && shown && (
        <AreaPanel postalCode={selected} row={row} roomType={roomType} trends={trends} onClose={() => select(null)} />
      )}

      <MapLoader steps={[shapes, rows !== null, shown]} error={error ?? shapesError} />
    </div>
  );
}

const LOADER_STEPS = ["3,018 postal code areas", "Prices and rents", "Drawing the map"];

function MapLoader({ steps: status, error }: { steps: boolean[]; error: string | null }) {
  const [gone, setGone] = useState(false);
  if (gone) return null;
  const done = status[status.length - 1];
  const steps = LOADER_STEPS.map((label, index) => ({ label, done: status[index] }));
  const progress = (status.filter(Boolean).length + 0.5) / (status.length + 0.5);
  return (
    <div
      className={`absolute inset-0 z-30 grid place-items-center bg-frost transition-opacity duration-500 ${done ? "pointer-events-none opacity-0" : ""}`}
      onTransitionEnd={() => done && setGone(true)}
      role="status"
      aria-live="polite"
    >
      <div className="w-[min(320px,calc(100%-48px))]">
        <p className="text-[13px] font-medium tracking-wide text-ink-3 uppercase">Housing market, Finland</p>
        <p className="mt-1 text-[22px] leading-tight font-semibold tracking-tight">Preparing the map</p>
        <div className="mt-5 h-1 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-ink transition-[width] duration-700 ease-out" style={{ width: `${progress * 100}%` }} />
        </div>
        {error ? (
          <div className="mt-5 text-sm">
            <p className="text-bad">{error}</p>
            <button type="button" onClick={() => window.location.reload()} className="mt-3 rounded-lg bg-ink px-4 py-2 font-medium text-paper">
              Try again
            </button>
          </div>
        ) : (
          <ul className="mt-5 space-y-2 text-sm">
            {steps.map((step) => (
              <li key={step.label} className={`flex items-center gap-2.5 transition-colors ${step.done ? "text-ink" : "text-ink-3"}`}>
                <span
                  className={`grid size-4 place-items-center rounded-full transition-colors ${step.done ? "bg-ink text-paper" : "border border-line-strong"}`}
                  aria-hidden="true"
                >
                  {step.done && (
                    <svg width="9" height="9" viewBox="0 0 12 12">
                      <path d="m2.5 6.2 2.3 2.3 4.7-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                {step.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function AreaPanel({
  postalCode,
  row,
  roomType,
  trends,
  onClose,
}: {
  postalCode: string;
  row: MapValue | undefined;
  roomType: RoomType;
  trends: MapTrends | null;
  onClose: () => void;
}) {
  const room = ROOM_TYPES.find((type) => type.value === roomType)!;
  const series = trends?.prices[postalCode];
  const points = useMemo(
    () =>
      trends && series
        ? trends.years.flatMap((year, index) => (series[index] === null ? [] : [{ year, value: series[index] as number }]))
        : [],
    [trends, series],
  );

  return (
    <aside className="panel-in absolute inset-x-3 bottom-3 z-20 flex max-h-[62%] flex-col overflow-hidden rounded-xl bg-paper shadow-float sm:inset-x-auto sm:top-4 sm:right-4 sm:bottom-auto sm:max-h-[calc(100%-2rem)]">
      <div className="flex w-full flex-col overflow-y-auto overscroll-contain sm:w-[380px]">
        <div className="flex items-start justify-between gap-4 px-5 pt-4 sm:pt-5">
          <div className="min-w-0">
            <h2 className="truncate text-[20px] leading-tight font-semibold tracking-tight sm:text-[22px]">
              {row?.postal_area_name ?? postalCode}
            </h2>
            <p className="num text-sm text-ink-3">
              {postalCode}
              {row ? `, ${row.municipality_name}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mt-1.5 -mr-2.5 grid size-10 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-well hover:text-ink"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
              <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {row ? (
          <dl className="mt-4 divide-y divide-line border-y border-line sm:mt-5">
            <Figure label={`Price, ${room.short}`} value={row.price_per_m2} digits={0} suffix=" / m²" estimated={isEstimated(row, "price")} />
            <Figure label="Rent" value={row.rent_per_m2} digits={2} suffix=" / m²" estimated={isEstimated(row, "rent")} />
            <Figure label="Price-to-rent" value={row.price_to_rent_ratio} digits={1} suffix=" years" currency={false} />
          </dl>
        ) : (
          <p className="px-5 pt-4 text-sm text-ink-3">No published figures for this area.</p>
        )}

        <div className="max-sm:hidden">
          {trends === null ? (
            <div className="shimmer mx-5 mt-4 h-[124px] rounded-lg" />
          ) : points.length > 2 ? (
            <PriceTrend points={points} />
          ) : null}
        </div>

        <div className="p-4 sm:p-5">
          <Link
            href={`/compare?postal=${postalCode}&rooms=${roomType}`}
            className="flex h-11 w-full items-center justify-center rounded-lg bg-ink text-[15px] font-medium text-paper transition-opacity hover:opacity-90"
          >
            Compare options here
          </Link>
        </div>
      </div>
    </aside>
  );
}

function Figure({
  label,
  value,
  digits,
  suffix,
  estimated,
  currency = true,
}: {
  label: string;
  value: number | null;
  digits: number;
  suffix: string;
  estimated?: boolean;
  currency?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between px-5 py-3">
      <dt className="text-sm text-ink-2">{label}</dt>
      <dd className="num text-right text-[17px] font-semibold">
        {value === null ? (
          "–"
        ) : (
          <>
            <NumberFlow
              value={value}
              locales="en-IE"
              format={{
                ...(currency ? { style: "currency" as const, currency: "EUR" } : {}),
                minimumFractionDigits: digits,
                maximumFractionDigits: digits,
              }}
            />
            {suffix}
          </>
        )}
        {estimated && value !== null && (
          <span className="ml-1 align-top text-[11px] font-normal text-ink-3" title="Figure from a larger area">
            ≈
          </span>
        )}
      </dd>
    </div>
  );
}

function PriceTrend({ points }: { points: { year: number; value: number }[] }) {
  const years = useMemo(() => points.map((point) => String(point.year)), [points]);
  const values = useMemo(() => points.map((point) => point.value), [points]);
  const change = values[values.length - 1] / values[0] - 1;
  const option = useMemo(
    () => ({
      animationDuration: 600,
      grid: { left: 0, right: 0, top: 8, bottom: 18 },
      xAxis: {
        type: "category",
        data: years,
        boundaryGap: false,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: INK_3, fontSize: 11, interval: (index: number) => index === 0 || index === years.length - 1 },
      },
      yAxis: { type: "value", scale: true, show: false },
      tooltip: {
        trigger: "axis",
        backgroundColor: "#fff",
        borderColor: LINE,
        textStyle: { color: "#1a2530", fontSize: 12 },
        formatter: (items: { name: string; value: number }[]) => `${items[0].name}: <b>${formatEuro(items[0].value)} / m²</b>`,
      },
      series: [
        {
          type: "line",
          data: values,
          smooth: 0.3,
          symbol: "none",
          lineStyle: { width: 2, color: "#2a78d6" },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(42,120,214,0.18)" },
                { offset: 1, color: "rgba(42,120,214,0)" },
              ],
            },
          },
        },
      ],
    }),
    [years, values],
  );
  return (
    <div className="px-5 pt-4">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-ink-2">Price per m² since {years[0]}</span>
        <span className={`num font-medium ${change >= 0 ? "text-good" : "text-bad"}`}>
          {change >= 0 ? "+" : "−"}
          {Math.round(Math.abs(change) * 100)}%
        </span>
      </div>
      <EChart option={option} height={96} label={`Price per m² from ${years[0]} to ${years[years.length - 1]}`} />
    </div>
  );
}
