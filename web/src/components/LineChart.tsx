"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface Series {
  key: string;
  label: string;
  color: string;
}

interface Props {
  title: string;
  subtitle?: string;
  data: Record<string, number | string | null>[];
  xKey: string;
  series: Series[];
  formatX?: (value: string | number) => string;
  formatY: (value: number) => string;
  marker?: { x: string | number; label: string };
  height?: number;
}

export function LineChart({
  title,
  subtitle,
  data,
  xKey,
  series,
  formatX = (value) => String(value),
  formatY,
  marker,
  height = 280,
}: Props) {
  const [showTable, setShowTable] = useState(false);

  return (
    <figure className="rounded-lg border border-border bg-surface p-4">
      <figcaption className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {subtitle && <p className="text-xs text-ink-secondary">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={() => setShowTable((value) => !value)}
          className="text-xs text-ink-secondary underline"
        >
          {showTable ? "Show chart" : "Show table"}
        </button>
      </figcaption>

      {series.length > 1 && (
        <ul className="mb-2 flex flex-wrap gap-4 text-xs text-ink-secondary">
          {series.map((item) => (
            <li key={item.key} className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 rounded" style={{ background: item.color }} />
              {item.label}
            </li>
          ))}
        </ul>
      )}

      {showTable ? (
        <div className="max-h-80 overflow-auto">
          <table className="tabular w-full text-right text-xs">
            <thead className="sticky top-0 bg-surface text-ink-secondary">
              <tr>
                <th className="py-1 text-left font-medium">{xKey === "year" ? "Year" : "Period"}</th>
                {series.map((item) => (
                  <th key={item.key} className="py-1 font-medium">
                    {item.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={String(row[xKey])} className="border-t border-border">
                  <td className="py-1 text-left">{formatX(row[xKey] as string)}</td>
                  {series.map((item) => (
                    <td key={item.key} className="py-1">
                      {typeof row[item.key] === "number" ? formatY(row[item.key] as number) : "–"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <RechartsLineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis
                dataKey={xKey}
                tickFormatter={formatX}
                stroke="var(--axis)"
                tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis
                tickFormatter={formatY}
                stroke="var(--axis)"
                tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={72}
              />
              <Tooltip
                cursor={{ stroke: "var(--axis)", strokeWidth: 1 }}
                content={({ active, label, payload }) =>
                  active && payload?.length ? (
                    <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-sm">
                      <p className="mb-1 text-ink-secondary">{formatX(label as string)}</p>
                      {payload.map((entry) => {
                        const item = series.find((s) => s.key === entry.dataKey);
                        return (
                          <p key={String(entry.dataKey)} className="flex items-center gap-2">
                            <span
                              className="inline-block h-0.5 w-3 rounded"
                              style={{ background: item?.color }}
                            />
                            <span className="tabular font-semibold text-ink">
                              {typeof entry.value === "number" ? formatY(entry.value) : "–"}
                            </span>
                            <span className="text-ink-secondary">{item?.label}</span>
                          </p>
                        );
                      })}
                    </div>
                  ) : null
                }
              />
              {marker && (
                <ReferenceLine
                  x={marker.x}
                  stroke="var(--axis)"
                  label={{ value: marker.label, position: "insideTopRight", fill: "var(--ink-muted)", fontSize: 11 }}
                />
              )}
              {series.map((item) => (
                <Line
                  key={item.key}
                  type="monotone"
                  dataKey={item.key}
                  name={item.label}
                  stroke={item.color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  dot={false}
                  activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </RechartsLineChart>
          </ResponsiveContainer>
        </div>
      )}
    </figure>
  );
}
