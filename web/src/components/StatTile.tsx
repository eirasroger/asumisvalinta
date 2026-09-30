interface Props {
  label: string;
  value: string;
  detail?: string;
  color?: string;
  highlight?: string;
}

export function StatTile({ label, value, detail, color, highlight }: Props) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="flex items-center gap-2 text-sm text-ink-secondary">
        {color && <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />}
        {label}
        {highlight && (
          <span className="ml-auto rounded-full border border-border px-2 py-0.5 text-xs text-ink">
            {highlight}
          </span>
        )}
      </p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      {detail && <p className="mt-1 text-xs text-ink-secondary">{detail}</p>}
    </div>
  );
}
