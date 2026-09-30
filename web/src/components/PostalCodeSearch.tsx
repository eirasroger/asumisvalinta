"use client";

import { useId, useRef, useState } from "react";
import { api, type PostalArea } from "@/lib/api";

interface Props {
  value: PostalArea | null;
  onChange: (area: PostalArea) => void;
}

export function PostalCodeSearch({ value, onChange }: Props) {
  const listId = useId();
  const [query, setQuery] = useState(value ? label(value) : "");
  const [results, setResults] = useState<PostalArea[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function search(text: string) {
    setQuery(text);
    if (timer.current) clearTimeout(timer.current);
    const trimmed = text.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(() => {
      api
        .searchPostalAreas(trimmed)
        .then((areas) => {
          setResults(areas);
          setOpen(true);
        })
        .catch(() => setResults([]));
    }, 200);
  }

  function choose(area: PostalArea) {
    onChange(area);
    setQuery(label(area));
    setResults([]);
    setOpen(false);
  }

  return (
    <div className="relative">
      <input
        type="text"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        placeholder="Postal code or area, e.g. 00100 or Kallio"
        value={query}
        onChange={(event) => search(event.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
      />
      {open && results.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-md border border-border bg-surface py-1 text-sm shadow-sm"
        >
          {results.map((area) => (
            <li key={area.postal_code} role="option" aria-selected={value?.postal_code === area.postal_code}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left hover:bg-page"
                onMouseDown={() => choose(area)}
              >
                <span className="tabular font-medium">{area.postal_code}</span>{" "}
                <span className="text-ink-secondary">
                  {area.postal_area_name}, {area.municipality_name}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function label(area: PostalArea) {
  return `${area.postal_code} ${area.postal_area_name}`;
}
