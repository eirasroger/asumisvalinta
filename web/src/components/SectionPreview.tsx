"use client";

import { useI18n } from "@/i18n/I18nProvider";

export type Section = "explore" | "compare" | "ask";

const SEQUENTIAL = ["var(--seq-1)", "var(--seq-2)", "var(--seq-3)", "var(--seq-4)", "var(--seq-5)", "var(--seq-6)"];

/** Honeycomb of areas shaded light to dark, as on the map; shades are fixed for a steady picture. */
const CELLS = [
  [0, 0, 1], [1, 0, 2], [2, 0, 1], [3, 0, 0],
  [0, 1, 2], [1, 1, 4], [2, 1, 3], [3, 1, 1], [4, 1, 0],
  [0, 2, 1], [1, 2, 3], [2, 2, 5], [3, 2, 4], [4, 2, 2],
  [1, 3, 2], [2, 3, 4], [3, 3, 3], [4, 3, 1],
];

function hexagon(cx: number, cy: number, r: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i + Math.PI / 6;
    return `${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`;
  }).join(" ");
}

function MapPreview() {
  const r = 13;
  const w = Math.sqrt(3) * r;
  return (
    <svg viewBox="0 0 150 110" className="h-full w-full" aria-hidden="true">
      {CELLS.map(([col, row, shade], index) => {
        const cx = 18 + col * (w + 2) + (row % 2) * (w / 2 + 1);
        const cy = 18 + row * (r * 1.5 + 2);
        const selected = col === 2 && row === 2;
        return (
          <polygon
            key={`${col}-${row}`}
            points={hexagon(cx, cy, r)}
            fill={SEQUENTIAL[shade]}
            stroke={selected ? "var(--ink)" : "var(--paper)"}
            strokeWidth={2}
            className="preview-pop"
            style={{ animationDelay: `${index * 35}ms` }}
          />
        );
      })}
    </svg>
  );
}

function ComparePreview() {
  const { t } = useI18n();
  const lines = [
    { option: "buy", color: "var(--series-buy)", d: "M8 82 C 45 72, 80 46, 116 20", y: 20 },
    { option: "aso", color: "var(--series-aso)", d: "M8 58 C 45 52, 80 42, 116 36", y: 38 },
    { option: "rent", color: "var(--series-rent)", d: "M8 58 C 45 54, 80 50, 116 50", y: 54 },
  ] as const;
  return (
    <svg viewBox="0 0 150 100" className="h-full w-full" aria-hidden="true">
      {[30, 55, 80].map((y) => (
        <line key={y} x1="8" x2="116" y1={y} y2={y} stroke="var(--line)" strokeDasharray="3 4" />
      ))}
      {lines.map((line, index) => (
        <g key={line.option}>
          <path
            d={line.d}
            fill="none"
            stroke={line.color}
            strokeWidth="2.5"
            strokeLinecap="round"
            pathLength={1}
            className="preview-draw"
            style={{ animationDelay: `${index * 120}ms` }}
          />
          <text x="121" y={line.y + 4} fontSize="9" fill="var(--ink-2)" className="preview-fade" style={{ animationDelay: `${500 + index * 120}ms` }}>
            {t.options.short[line.option]}
          </text>
        </g>
      ))}
    </svg>
  );
}

function AskPreview() {
  const { t } = useI18n();
  return (
    <svg viewBox="0 0 150 100" className="h-full w-full" aria-hidden="true">
      <g className="preview-fade">
        <rect x="38" y="10" width="104" height="26" rx="10" fill="var(--ink)" />
        <text x="48" y="27" fontSize="9" fill="var(--paper)">
          {t.preview.askQuestion}
        </text>
      </g>
      <g className="preview-fade" style={{ animationDelay: "350ms" }}>
        <rect x="8" y="46" width="112" height="40" rx="10" fill="var(--well)" />
        <text x="18" y="63" fontSize="9" fill="var(--ink-2)">
          {t.preview.askAnswer}
        </text>
        <text x="18" y="78" fontSize="12" fontWeight="600" fill="var(--ink)">
          {t.preview.askValue}
        </text>
      </g>
    </svg>
  );
}

export function SectionPreview({ section }: { section: Section }) {
  if (section === "explore") return <MapPreview />;
  if (section === "compare") return <ComparePreview />;
  return <AskPreview />;
}
