"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { splitLocale } from "@/i18n/config";
import { useI18n } from "@/i18n/I18nProvider";

export function Footer({ dataDocs }: { dataDocs: boolean }) {
  const { t, href } = useI18n();
  if (splitLocale(usePathname()).path === "/explore") return null;
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-2 px-4 py-6 text-xs text-ink-3 sm:flex-row sm:justify-between sm:px-6">
        <p>{t.footer.note}</p>
        <p className="flex gap-4">
          <Link href={href("/about")} className="hover:text-ink">
            {t.footer.about}
          </Link>
          <Link href={href("/methodology")} className="hover:text-ink">
            {t.footer.methodology}
          </Link>
          <Link href={href("/privacy")} className="hover:text-ink">
            {t.footer.privacy}
          </Link>
          {dataDocs && (
            // eslint-disable-next-line @next/next/no-html-link-for-pages -- static dbt docs in public/, not a page
            <a href="/data-docs/index.html" className="hover:text-ink">
              {t.footer.dataModel}
            </a>
          )}
        </p>
      </div>
    </footer>
  );
}
