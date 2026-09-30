"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Explore" },
  { href: "/compare", label: "Compare" },
  { href: "/ask", label: "Ask" },
  { href: "/methodology", label: "Methodology" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex h-full items-stretch gap-6 overflow-x-auto text-sm [scrollbar-width:none]">
      {LINKS.map((link) => {
        const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px flex items-center border-b-2 whitespace-nowrap transition-colors ${
              active ? "border-ink font-medium text-ink" : "border-transparent text-ink-3 hover:text-ink"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
