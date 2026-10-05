import type { Messages } from "@/i18n/messages";
import type { Option } from "@/lib/api";

/** Visuals shared by the front page and the About page; illustrations, not live results. */

export const NIGHT = "bg-[#0e1a26]";
export const MIST = "bg-[#eaf2fc]";
export const OPTIONS: Option[] = ["rent", "aso", "buy"];
export const OPTION_DOT: Record<Option, string> = { rent: "bg-rent", aso: "bg-aso", buy: "bg-buy" };

export function WealthChart({ t }: { t: Messages }) {
  const lines: { option: Option; d: string; end: [number, number] }[] = [
    { option: "rent", d: "M40 214C170 196 320 170 480 140", end: [480, 140] },
    { option: "aso", d: "M40 226C170 200 320 158 480 112", end: [480, 112] },
    { option: "buy", d: "M40 262C150 244 300 160 480 56", end: [480, 56] },
  ];
  return (
    <div className="rounded-2xl bg-paper p-5 shadow-float ring-1 ring-line sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] font-semibold">{t.outcome.wealthChart}</p>
        <p className="flex gap-3 text-xs text-ink-3">
          {OPTIONS.map((option) => (
            <span key={option} className="flex items-center gap-1.5">
              <span className={`size-2 rounded-full ${OPTION_DOT[option]}`} />
              {t.options.short[option]}
            </span>
          ))}
        </p>
      </div>
      <svg viewBox="0 0 500 290" className="mt-4 w-full" aria-hidden="true">
        <defs>
          <linearGradient id="wealth-buy-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--series-buy)" stopOpacity="0.16" />
            <stop offset="1" stopColor="var(--series-buy)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[40, 100, 160, 220].map((y) => (
          <line key={y} x1="40" x2="480" y1={y} y2={y} stroke="var(--line)" strokeDasharray="3 5" />
        ))}
        <line x1="40" x2="480" y1="270" y2="270" stroke="var(--line-strong)" />
        {Array.from({ length: 10 }, (_, index) => (
          <text key={index} x={40 + (index + 1) * 44} y="286" textAnchor="middle" className="fill-ink-3 text-[11px]">
            {index + 1}
          </text>
        ))}
        <path d="M40 262C150 244 300 160 480 56V270H40Z" fill="url(#wealth-buy-fill)" />
        {lines.map(({ option, d, end }) => (
          <g key={option}>
            <path d={d} pathLength={1} fill="none" stroke={`var(--series-${option})`} strokeWidth="3" strokeLinecap="round" className="draw" />
            <circle cx={end[0]} cy={end[1]} r="5" fill={`var(--series-${option})`} stroke="var(--paper)" strokeWidth="2" />
          </g>
        ))}
      </svg>
    </div>
  );
}

/** The Helsinki area's postal code areas in an organic frame, from scripts/build-about-maps.mjs. */
export function HelsinkiMap() {
  return (
    <div className="relative">
      <span aria-hidden="true" className="dots absolute -top-8 -left-6 h-32 w-44 text-buy/40" />
      <div className={`relative overflow-hidden rounded-[44%_56%_48%_52%/56%_44%_56%_44%] ${MIST} p-8 sm:p-12`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, no optimisation needed */}
        <img src="/about/helsinki.svg" alt="" className="w-full" />
      </div>
    </div>
  );
}

/** A question to the assistant and the shape of its answer, without figures. */
export function AskThread({ t }: { t: Messages }) {
  const bars = [38, 44, 47, 52, 58, 61, 66];
  return (
    <div className="relative">
      <span aria-hidden="true" className="dots absolute -right-5 -bottom-6 h-32 w-40 text-aso/40" />
      <div className="relative space-y-4 rounded-[28px] border border-line bg-paper p-5 shadow-float sm:p-7">
        <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-ink px-4 py-3 text-[14px] leading-relaxed text-paper">
          {t.ask.examples[2]}
        </p>
        <div className="max-w-[90%] rounded-2xl rounded-bl-md bg-frost p-4 sm:p-5">
          <p className="flex items-center gap-2 text-xs font-medium text-ink-2">
            <span className="size-2 rounded-full bg-aso" />
            {t.ask.status.answered}
          </p>
          <div className="mt-3 space-y-2" aria-hidden="true">
            <span className="block h-2 w-[92%] rounded-full bg-line-strong/60" />
            <span className="block h-2 w-[78%] rounded-full bg-line-strong/60" />
          </div>
          <svg viewBox="0 0 210 70" className="mt-4 w-full" aria-hidden="true">
            {bars.map((height, index) => (
              <rect key={index} x={index * 30 + 4} y={70 - height} width="20" height={height} rx="3" fill="var(--series-aso)" opacity={0.35 + index * 0.1} />
            ))}
          </svg>
          <p className="mt-3 text-xs text-ink-3">{t.ask.basedOn}
            {t.home.askSource}</p>
        </div>
      </div>
    </div>
  );
}
