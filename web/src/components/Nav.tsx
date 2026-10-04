"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { type Section, SectionPreview } from "@/components/SectionPreview";
import { splitLocale } from "@/i18n/config";
import { useI18n } from "@/i18n/I18nProvider";

const LINKS: { path: string; key: Section }[] = [
  { path: "/explore", key: "explore" },
  { path: "/compare", key: "compare" },
  { path: "/ask", key: "ask" },
];

export function Nav() {
  const { t, href } = useI18n();
  const { path: current } = splitLocale(usePathname());
  const [preview, setPreview] = useState<Section | null>(null);
  return (
    <nav className="flex h-full items-stretch gap-6 overflow-x-auto max-[380px]:gap-4 text-sm [scrollbar-width:none] sm:overflow-visible">
      {LINKS.map((link) => {
        const active = current.startsWith(link.path);
        return (
          <div
            key={link.path}
            className="relative flex"
            onMouseEnter={() => setPreview(link.key)}
            onMouseLeave={() => setPreview(null)}
          >
            <Link
              href={href(link.path)}
              aria-current={active ? "page" : undefined}
              onFocus={() => setPreview(link.key)}
              onBlur={() => setPreview(null)}
              onClick={() => setPreview(null)}
              className={`-mb-px flex items-center border-b-2 whitespace-nowrap transition-colors ${
                active ? "border-ink font-medium text-ink" : "border-transparent text-ink-3 hover:text-ink"
              }`}
            >
              {t.nav[link.key]}
            </Link>
            {preview === link.key && (
              <div
                role="tooltip"
                className="panel-in absolute top-full left-1/2 z-50 mt-2 hidden w-64 -translate-x-1/2 rounded-xl border border-line bg-paper p-3 shadow-float [@media(hover:hover)]:block"
              >
                <div className="h-28 rounded-lg bg-frost p-2">
                  <SectionPreview section={link.key} />
                </div>
                <p className="mt-2.5 text-[13px] leading-snug text-ink-2">{t.preview[link.key]}</p>
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
