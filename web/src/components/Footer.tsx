"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Footer({ dataDocs }: { dataDocs: boolean }) {
  if (usePathname() === "/") return null;
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-2 px-4 py-6 text-xs text-ink-3 sm:flex-row sm:justify-between sm:px-6">
        <p>
          Estimates, not financial advice. Source: Statistics Finland (CC BY 4.0). Source: ECB statistics. Asuntosäätiö
          listings.
        </p>
        <p className="flex gap-4">
          <Link href="/methodology" className="hover:text-ink">
            Methodology
          </Link>
          <Link href="/privacy" className="hover:text-ink">
            Privacy
          </Link>
          {dataDocs && (
            <a href="/data-docs/index.html" className="hover:text-ink">
              Data model
            </a>
          )}
        </p>
      </div>
    </footer>
  );
}
