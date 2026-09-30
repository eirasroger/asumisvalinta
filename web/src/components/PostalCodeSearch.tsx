"use client";

import { useEffect, useId, useRef, useState } from "react";
import { api, type PostalArea } from "@/lib/api";

interface Props {
  onChange: (area: PostalArea) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export function PostalCodeSearch({ onChange, placeholder = "Search postal code or area", autoFocus }: Props) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PostalArea[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function search(text: string) {
    setQuery(text);
    if (timer.current) clearTimeout(timer.current);
    const trimmed = text.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(() => {
      api.searchPostalAreas(trimmed).then(
        (areas) => {
          setResults(areas);
          setActive(0);
          setOpen(true);
        },
        () => setResults([]),
      );
    }, 160);
  }

  function choose(area: PostalArea) {
    onChange(area);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  const expanded = open && results.length > 0;

  return (
    <div className="relative">
      <div className="flex h-10 items-center gap-2 rounded-lg border border-line bg-paper px-3 transition-[border-color,box-shadow] focus-within:border-buy focus-within:shadow-[0_0_0_3px_var(--focus)]">
        <svg className="shrink-0 text-ink-3" width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="7" cy="7" r="4.8" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="m10.6 10.6 3.4 3.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          role="combobox"
          aria-label="Search postal code or area"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={expanded ? `${listId}-${active}` : undefined}
          autoFocus={autoFocus}
          placeholder={placeholder}
          value={query}
          onChange={(event) => search(event.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(event) => {
            if (!expanded) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((index) => Math.min(index + 1, results.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((index) => Math.max(index - 1, 0));
            } else if (event.key === "Enter") {
              event.preventDefault();
              choose(results[active]);
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
          className="h-full w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-ink-3"
        />
      </div>
      {expanded && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1.5 max-h-72 w-full overflow-auto rounded-xl border border-line bg-paper p-1 text-sm shadow-float"
        >
          {results.map((area, index) => (
            <li
              key={area.postal_code}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              onMouseDown={() => choose(area)}
              onMouseEnter={() => setActive(index)}
              className={`flex cursor-pointer items-baseline gap-2.5 rounded-lg px-2.5 py-2 ${index === active ? "bg-well" : ""}`}
            >
              <span className="num text-ink-3">{area.postal_code}</span>
              <span className="font-medium">{area.postal_area_name}</span>
              <span className="ml-auto text-[13px] text-ink-3">{area.municipality_name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
