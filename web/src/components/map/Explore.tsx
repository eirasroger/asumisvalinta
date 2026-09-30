"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { EChart, INK_3, LINE } from "@/components/charts/EChart";
import type { HoverInfo } from "@/components/map/AreaMap";
import { PostalCodeSearch } from "@/components/PostalCodeSearch";
import { track } from "@/lib/analytics";
import { Segmented } from "@/components/ui";
import { api, type Market, ROOM_TYPES, type RoomType, type SeriesPoint } from "@/lib/api";
import { formatEuro, formatEuroCents, formatNumber } from "@/lib/format";
import {
  inScope,
  type MapMetric,
  type MapScope,
  METRICS,
  metricValue,
  quantileCuts,
  SCOPES,
  SEQUENTIAL,
  useMapValues,
} from "@/lib/mapData";

const AreaMap = dynamic(() => import("@/components/map/AreaMap").then((module) => module.AreaMap), { ssr: false });

const PANEL = 380;

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
  const { rows, error } = useMapValues(roomType);
  const info = METRICS.find((item) => item.value === metric)!;

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
        padding={{ right: selected ? PANEL + 16 : 0, bottom: 0 }}
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
        {error && <p className="pointer-events-auto rounded-lg bg-paper px-3 py-2 text-sm text-bad shadow-float">{error}</p>}
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
          className="pointer-events-none absolute z-20 rounded-lg bg-paper px-3 py-2 shadow-float"
          style={{ left: hover.x + 14, top: hover.y + 14 }}
        >
          <p className="text-[13px]">
            <span className="font-medium">{hover.name}</span> <span className="num text-ink-3">{hover.postal_code}</span>
          </p>
          <p className="num text-[15px] font-semibold">{hover.value !== null ? info.exact(hover.value) : "No data"}</p>
        </div>
      )}

      {selected && <AreaPanel postalCode={selected} roomType={roomType} onClose={() => select(null)} />}
    </div>
  );
}

function AreaPanel({ postalCode, roomType, onClose }: { postalCode: string; roomType: RoomType; onClose: () => void }) {
  const [market, setMarket] = useState<Market | null>(null);
  const [prices, setPrices] = useState<SeriesPoint[]>([]);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    Promise.all([api.market(postalCode), api.marketHistory(postalCode, roomType)]).then(
      ([levels, history]) => {
        if (!current) return;
        setMarket(levels);
        setPrices(history.prices.filter((point) => typeof point.avg_price_per_m2_annual === "number"));
        setFailed(null);
      },
      (caught: Error) => current && setFailed(caught.message),
    );
    return () => {
      current = false;
    };
  }, [postalCode, roomType]);

  const level = market?.levels.find((item) => item.room_type === roomType);
  const loaded = market?.postal_area.postal_code === postalCode;
  const room = ROOM_TYPES.find((type) => type.value === roomType)!;

  return (
    <aside
      className="absolute inset-x-3 bottom-3 z-20 flex max-h-[70%] flex-col overflow-hidden rounded-xl bg-paper shadow-float sm:inset-x-auto sm:top-4 sm:right-4 sm:bottom-auto sm:max-h-[calc(100%-2rem)]"
    >
      <div className="flex w-full flex-col overflow-y-auto sm:w-[380px]">
        <div className="flex items-start justify-between gap-4 px-5 pt-5">
          <div className="min-w-0">
            <h2 className="truncate text-[22px] leading-tight font-semibold tracking-tight">
              {loaded ? market.postal_area.postal_area_name : " "}
            </h2>
            <p className="num text-sm text-ink-3">
              {postalCode}
              {loaded ? `, ${market.postal_area.municipality_name}` : ""}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="-mt-1 -mr-2 rounded-md p-2 text-ink-3 hover:bg-well hover:text-ink">
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
              <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {failed && <p className="px-5 pt-4 text-sm text-bad">{failed}</p>}

        {loaded && level && (
          <>
            <dl className="mt-5 divide-y divide-line border-y border-line">
              <Figure label={`Price, ${room.short}`} value={`${formatEuro(level.price_per_m2)} / m²`} estimated={level.price_geography_level !== "postal_code"} />
              <Figure label="Rent" value={`${formatEuroCents(level.rent_per_m2)} / m²`} estimated={level.rent_geography_level !== "postal_code"} />
              <Figure
                label="Price-to-rent"
                value={level.price_to_rent_ratio !== null ? `${formatNumber(level.price_to_rent_ratio)} years` : "–"}
              />
            </dl>
            {prices.length > 2 && (
              <div className="max-sm:hidden">
                <PriceTrend points={prices} />
              </div>
            )}
          </>
        )}

        <div className="p-5">
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

function Figure({ label, value, estimated }: { label: string; value: string; estimated?: boolean }) {
  return (
    <div className="flex items-baseline justify-between px-5 py-3">
      <dt className="text-sm text-ink-2">{label}</dt>
      <dd className="num text-right text-[17px] font-semibold">
        {value}
        {estimated && (
          <span className="ml-1 align-top text-[11px] font-normal text-ink-3" title="Figure from a larger area">
            ≈
          </span>
        )}
      </dd>
    </div>
  );
}

function PriceTrend({ points }: { points: SeriesPoint[] }) {
  const years = useMemo(() => points.map((point) => String(point.period).slice(0, 4)), [points]);
  const values = useMemo(() => points.map((point) => point.avg_price_per_m2_annual as number), [points]);
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
