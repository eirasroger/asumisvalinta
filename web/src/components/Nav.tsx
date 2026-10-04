"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { splitLocale } from "@/i18n/config";
import { useI18n } from "@/i18n/I18nProvider";

const LINKS = [
  { path: "/", key: "explore" },
  { path: "/compare", key: "compare" },
  { path: "/ask", key: "ask" },
  { path: "/methodology", key: "methodology" },
] as const;

export function Nav() {
  const { t, href } = useI18n();
  const { path: current } = splitLocale(usePathname());
  return (
    <nav className="flex h-full items-stretch gap-6 overflow-x-auto text-sm [scrollbar-width:none]">
      {LINKS.map((link) => {
        const active = link.path === "/" ? current === "/" : current.startsWith(link.path);
        return (
          <Link
            key={link.path}
            href={href(link.path)}
            aria-current={active ? "page" : undefined}
            className={`-mb-px flex items-center border-b-2 whitespace-nowrap transition-colors ${
              active ? "border-ink font-medium text-ink" : "border-transparent text-ink-3 hover:text-ink"
            }`}
          >
            {t.nav[link.key]}
          </Link>
        );
      })}
    </nav>
  );
}
