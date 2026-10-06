"use client";

import { useLayoutEffect, useRef } from "react";
import { useI18n } from "@/i18n/I18nProvider";

const SWEEP_MS = 2400;

/** A soft placeholder shape. */
function Bone({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <span aria-hidden="true" className={`bone block ${className}`} style={style} />;
}

/** A line of text still loading: a pill centred in a line box of the real text's height. */
function Text({ width, line = "h-5", size = "h-2.5" }: { width: string; line?: string; size?: string }) {
  return (
    <span aria-hidden="true" className={`flex items-center ${line}`}>
      <span className={`bone block rounded-full ${size} ${width}`} />
    </span>
  );
}

/** An input frame with its value still loading. */
function Field({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`flex h-9 items-center justify-end rounded-lg border border-line px-3 ${className}`}>
      <span className="bone block h-2.5 w-14 rounded-full" />
    </span>
  );
}

/** The compare page while its figures load, laid out exactly like the loaded page. */
export function PlannerSkeleton() {
  const { t } = useI18n();
  const root = useRef<HTMLDivElement>(null);

  // Every copy of the skeleton sweeps in step, so swapping one for another does not restart the highlight.
  useLayoutEffect(() => {
    const painted = performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0;
    root.current?.style.setProperty("--sweep-delay", `${-((performance.now() - painted) % SWEEP_MS)}ms`);
  }, []);

  const cell = "flex flex-col justify-center gap-1.5 border-line px-5 py-3 lg:border-l";
  return (
    <div ref={root} aria-busy="true" className="skeleton mx-auto max-w-[1240px] px-4 pt-5 pb-16 sm:px-6">
      <span role="status" className="sr-only">
        {t.common.loading}
      </span>

      <div className="grid grid-cols-2 rounded-xl border border-line bg-paper lg:flex lg:items-stretch">
        <div className="col-span-2 flex min-w-0 flex-1 flex-col justify-center border-line px-5 py-3 max-lg:border-b">
          <Text width="w-52" line="h-6" size="h-3.5" />
          <Text width="w-28" />
        </div>
        <div className={`${cell} max-lg:col-span-2`}>
          <Text width="w-12" line="h-[19px]" />
          <Bone className="h-8 rounded-lg lg:w-[230px]" />
        </div>
        <div className={cell}>
          <Text width="w-10" line="h-[19px]" />
          <Field className="w-24" />
        </div>
        <div className={cell}>
          <Text width="w-16" line="h-[19px]" />
          <Field className="w-24" />
        </div>
        <div className={`${cell} max-lg:col-span-2 lg:max-w-64 lg:min-w-52 lg:flex-1`}>
          <Text width="w-16" line="h-[19px]" />
          <span className="flex h-5 items-center">
            <Bone className="h-1 w-full rounded-full" />
          </span>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[400px_minmax(0,1fr)] lg:gap-8">
        <div className="space-y-3">
          <div className="rounded-xl border border-line bg-paper">
            <Section rows={["w-28"]} />
            <Section rows={["w-24", "w-28", "w-32", "w-40", "w-20"]} guide="w-48" wraps={3} />
            <Section rows={["w-36", "w-28"]} guide="w-40" toggle />
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-line bg-paper px-5 py-3.5">
            <Text width="w-20" size="h-3" />
            <span className="ml-auto flex flex-wrap justify-end gap-1.5 max-[385px]:flex-col max-[385px]:items-end">
              <Bone className="h-6 w-28 rounded-md" />
              <Bone className="h-6 w-[85px] rounded-md" />
              <Bone className="h-6 w-[124px] rounded-md" />
            </span>
            <span className="w-3 shrink-0" />
          </div>
        </div>

        <div className="space-y-5">
          <div className="px-1">
            <span className="flex h-[23px] items-center gap-2">
              <Bone className="size-2 rounded-full" />
              <Bone className="h-3 w-full max-w-64 rounded-full" />
            </span>
            <span className="flex h-[23px] items-center sm:hidden">
              <Bone className="h-3 w-24 rounded-full" />
            </span>
            <span className="mt-1 flex h-[83px] items-center">
              <Bone className="h-12 w-56 rounded-xl" />
            </span>
            <span className="mt-2 flex h-[23px] items-center">
              <Bone className="h-3 w-full max-w-80 rounded-full" />
            </span>
            <span className="flex h-[23px] items-center sm:hidden">
              <Bone className="h-3 w-32 rounded-full" />
            </span>
          </div>

          <div className="rounded-xl border border-line bg-paper px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <Text width="w-36" line="h-[22px]" size="h-3" />
              <Text width="w-48" />
            </div>
            <div className="mt-3 space-y-2.5">
              {["100%", "79%", "66%"].map((bar, index) => (
                <div
                  key={bar}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 sm:grid-cols-[minmax(0,140px)_1fr_auto]"
                >
                  <span className="flex h-5 items-center gap-2">
                    <Bone className="size-2 rounded-full" />
                    <Bone className={`h-2.5 rounded-full ${index === 2 ? "w-24" : "w-14"}`} />
                  </span>
                  <span className="flex h-2.5 max-sm:order-last max-sm:col-span-2">
                    <Bone className="h-full rounded-full" style={{ width: bar }} />
                  </span>
                  <span className="flex justify-end sm:w-36">
                    <Bone className={`h-2.5 rounded-full ${index === 0 ? "w-12" : "w-24"}`} />
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-line bg-paper">
            <div className="flex h-12 items-center gap-5 border-b border-line px-5">
              <Bone className="h-2.5 w-16 rounded-full" />
              <Bone className="h-2.5 w-20 rounded-full" />
              <Bone className="h-2.5 w-12 rounded-full" />
            </div>
            <GhostChart />
            <div className="border-t border-line">
              <div className="flex h-10 items-center gap-6 px-5 max-sm:h-[59px]">
                <Bone className="mr-auto h-2 w-14 rounded-full" />
                <Bone className="h-2 w-24 rounded-full" />
                <Bone className="h-2 w-24 rounded-full max-sm:hidden" />
                <Bone className="h-2 w-12 rounded-full" />
              </div>
              {[0, 1, 2].map((row) => (
                <div key={row} className="flex h-[46px] items-center gap-6 border-t border-line px-5">
                  <span className="mr-auto flex items-center gap-2.5">
                    <Bone className="size-2 rounded-full" />
                    <Bone className={`h-2.5 rounded-full ${row === 2 ? "w-28" : "w-14"}`} />
                  </span>
                  <Bone className="h-2.5 w-20 rounded-full" />
                  <Bone className="h-2.5 w-14 rounded-full max-sm:hidden" />
                  <Bone className="h-2.5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          </div>

          <span className="flex h-5 items-center px-1">
            <Bone className="h-2.5 w-56 rounded-full" />
          </span>
        </div>
      </div>
    </div>
  );
}

/** `wraps` marks the row whose label takes two lines on a phone. */
function Section({ rows, guide, toggle, wraps }: { rows: string[]; guide?: string; toggle?: boolean; wraps?: number }) {
  return (
    <div className="border-b border-line px-5 py-4 last:border-b-0">
      <div className="flex items-center gap-2.5">
        <Bone className="size-2 rounded-full" />
        <Text width="w-24" line="h-[22px]" size="h-3" />
        {toggle && <Bone className="ml-auto h-5 w-9 rounded-full" />}
      </div>
      <div className="mt-3 space-y-3">
        {rows.map((width, index) => (
          <div key={index} className="grid grid-cols-[1fr_160px] items-center gap-x-3 max-[389px]:grid-cols-[1fr_140px]">
            <Text width={width} line={index === wraps ? "h-5 max-sm:h-[46px]" : "h-5"} />
            <Field />
          </div>
        ))}
        {guide && <Text width={guide} line="h-5 lg:h-[23px]" />}
      </div>
    </div>
  );
}

/** Where the wealth chart will be: grid lines and the outline of three rising lines. */
function GhostChart() {
  return (
    <div className="mx-3 mt-3 mb-1 h-[260px] py-3 sm:mx-4">
      <svg viewBox="0 0 600 236" preserveAspectRatio="none" className="size-full" aria-hidden="true">
        <defs>
          <linearGradient id="ghost-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--bone)" stopOpacity="0.9" />
            <stop offset="1" stopColor="var(--bone)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[8, 60, 112, 164, 216].map((y) => (
          <line key={y} x1="0" x2="600" y1={y} y2={y} stroke="var(--line)" vectorEffect="non-scaling-stroke" />
        ))}
        <path d="M0 196 C 150 170, 300 120, 600 30 L 600 216 L 0 216 Z" fill="url(#ghost-fill)" />
        <g fill="none" stroke="var(--bone)" strokeWidth="2.5" strokeLinecap="round">
          <path d="M0 196 C 150 170, 300 120, 600 30" vectorEffect="non-scaling-stroke" />
          <path d="M0 150 C 180 132, 380 96, 600 58" vectorEffect="non-scaling-stroke" />
          <path d="M0 150 C 200 140, 400 112, 600 92" vectorEffect="non-scaling-stroke" />
        </g>
      </svg>
    </div>
  );
}
