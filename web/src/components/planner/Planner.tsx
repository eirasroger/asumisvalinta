"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AdSlot } from "@/components/AdSlot";
import { AssumptionInputs } from "@/components/planner/AssumptionInputs";
import { Outcome } from "@/components/planner/Outcome";
import { PlannerSkeleton } from "@/components/planner/PlannerSkeleton";
import { YourNumbers } from "@/components/planner/YourNumbers";
import { PostalCodeSearch } from "@/components/PostalCodeSearch";
import { Hint, NumberField, Popover, Segmented, Slider } from "@/components/ui";
import { useI18n } from "@/i18n/I18nProvider";
import { ApiError, api, type PlannerRun, type PlannerStart, ROOM_TYPES } from "@/lib/api";
import {
  type Assumptions,
  buildScenario,
  DEFAULT_ASSUMPTIONS,
  type Flat,
  flatFromParams,
  flatToParams,
  MARKET_OFFER,
  type Offer,
  offerValue,
  typicalValues,
} from "@/lib/planner";

function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export function Planner() {
  const { t, locale, href } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const [flat, setFlat] = useState<Flat>(() => flatFromParams(new URLSearchParams(params.toString())));
  const [start, setStart] = useState<PlannerStart | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [offer, setOffer] = useState<Offer>(MARKET_OFFER);
  const [assumptions, setAssumptions] = useState<Assumptions>(DEFAULT_ASSUMPTIONS);
  const [run, setRun] = useState<PlannerRun | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const current = useRef(flat);
  const [refresh, setRefresh] = useState(0);

  const update = (patch: Partial<Flat>) => setFlat((current) => ({ ...current, ...patch }));

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api
        .plannerStart(
          { postal_code: flat.postal_code, room_type: flat.room_type, size_m2: flat.size_m2, building_year: flat.building_year },
          locale,
          controller.signal,
        )
        .then((next) => {
          setStart(next);
          setStartError(null);
        })
        .catch((error) => !isAbort(error) && setStartError(error.message));
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [flat.postal_code, flat.room_type, flat.size_m2, flat.building_year, refresh, locale]);

  useEffect(() => {
    const timer = setTimeout(() => router.replace(`${href("/compare")}?${flatToParams(flat)}`, { scroll: false }), 400);
    return () => clearTimeout(timer);
  }, [flat, router, href]);

  const typical = useMemo(() => (start ? typicalValues(start, flat.size_m2, offer) : null), [start, flat.size_m2, offer]);
  const scenario = useMemo(
    () => (start ? buildScenario(start, flat, offer, assumptions) : null),
    [start, flat, offer, assumptions],
  );

  useEffect(() => {
    if (!scenario) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setRunning(true);
      api
        .plannerRun(scenario, current.current, locale, controller.signal)
        .then((next) => {
          setRun(next);
          setRunError(null);
        })
        .catch((error) => {
          if (isAbort(error)) return;
          // Defaults loaded before an update of the service no longer match it: load them again once.
          if (error instanceof ApiError && error.status === 422 && refresh === 0) setRefresh(1);
          else setRunError(error.message);
        })
        .finally(() => !controller.signal.aborted && setRunning(false));
    }, 120);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [scenario, refresh, locale]);

  // The flat goes with each run so the server can record it as anonymous usage.
  useEffect(() => {
    current.current = flat;
  }, [flat]);

  const area = start?.market;

  // The first load shows one skeleton until every figure is ready; later changes keep the page in place.
  if (!run && !startError && !runError) return <PlannerSkeleton />;

  return (
    <div className="mx-auto max-w-[1240px] px-4 pt-5 pb-16 sm:px-6">
      <div className="assemble grid grid-cols-2 rounded-xl border border-line bg-paper lg:flex lg:items-stretch">
        <div className="col-span-2 flex min-w-0 flex-1 items-center gap-3 border-line px-5 py-3 max-lg:border-b">
          <Popover
            align="start"
            trigger={
              <button type="button" className="group min-w-0 text-left">
                <span className="block truncate text-[19px] leading-tight font-semibold tracking-tight group-hover:underline">
                  {area?.postal_area_name ?? " "}
                </span>
                <span className="num block text-[13px] text-ink-3">
                  {flat.postal_code}
                  {area ? `, ${area.municipality_name}` : ""}
                </span>
              </button>
            }
          >
            <PostalCodeSearch
              autoFocus
              onChange={(next) => update({ postal_code: next.postal_code })}
            />
            <Link
              href={`${href("/explore")}?postal=${flat.postal_code}&rooms=${flat.room_type}`}
              className="mt-3 block text-center text-[13px] text-ink-2 hover:text-ink hover:underline"
            >
              {t.planner.chooseOnMap}
            </Link>
          </Popover>
        </div>
        <Cell full label={<Hint trigger={<button type="button" className="underline decoration-line-strong decoration-dotted underline-offset-4">{t.planner.home}</button>}>{t.rooms.note}</Hint>}>
          <Segmented
            label={t.planner.home}
            size="sm"
            className="max-lg:w-full"
            value={flat.room_type}
            onChange={(room_type) => update({ room_type })}
            options={ROOM_TYPES.map((type) => ({ value: type, label: t.rooms.compact[type] }))}
          />
        </Cell>
        <Cell label={t.planner.size}>
          <NumberField
            label={t.planner.size}
            className="w-24"
            suffix="m²"
            min={10}
            max={300}
            value={flat.size_m2}
            onChange={(size) => update({ size_m2: Math.round(size) })}
          />
        </Cell>
        <Cell label={t.planner.built}>
          <NumberField
            label={t.planner.yearBuilt}
            className="w-24"
            grouping={false}
            placeholder={t.planner.yearPlaceholder}
            value={flat.building_year}
            onChange={(year) => update({ building_year: year >= 1800 && year <= 2035 ? Math.round(year) : null })}
            onClear={() => update({ building_year: null })}
          />
        </Cell>
        <Cell label={t.planner.horizon(flat.horizon_years)} wide full>
          <Slider label={t.planner.years} min={1} max={30} value={flat.horizon_years} onChange={(years) => update({ horizon_years: years })} />
        </Cell>
      </div>

      {(startError || runError) && (
        <p className="mt-4 rounded-lg border border-line bg-paper px-4 py-3 text-sm text-bad">{startError ?? runError}</p>
      )}

      {start && typical && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[400px_minmax(0,1fr)] lg:gap-8">
          <div className="assemble space-y-3" style={{ "--delay": "60ms" } as React.CSSProperties}>
            <YourNumbers
              start={start}
              flat={flat}
              offer={offer}
              typical={typical}
              onOffer={setOffer}
              assumptions={assumptions}
              onAssumptions={setAssumptions}
            />
            <AssumptionInputs
              start={start}
              assumptions={assumptions}
              onChange={setAssumptions}
              price={offerValue(offer, typical, "price")}
            />
          </div>
          <div className="lg:sticky lg:top-[76px] lg:self-start">
            {run && <Outcome run={run} loading={running} strategy={scenario?.investment.surplus_strategy ?? "park"} />}
          </div>
        </div>
      )}
      {run && <AdSlot className="mx-auto mt-16 max-w-3xl" />}
    </div>
  );
}

function Cell({ label, wide, full, children }: { label: React.ReactNode; wide?: boolean; full?: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`flex flex-col justify-center gap-1.5 border-line px-5 py-3 lg:border-l ${wide ? "lg:min-w-52 lg:max-w-64 lg:flex-1" : ""} ${full ? "max-lg:col-span-2" : ""}`}
    >
      <span className="num text-[13px] text-ink-3">{label}</span>
      {children}
    </div>
  );
}
