"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { splitLocale } from "@/i18n/config";
import { useI18n } from "@/i18n/I18nProvider";
import { ADS_LIVE } from "@/lib/site";

interface TcData {
  gdprApplies?: boolean;
}

declare global {
  interface Window {
    googlefc?: { callbackQueue?: object[]; showRevocationMessage?: () => void };
    __tcfapi?: (command: string, version: number, callback: (data: TcData | null, success: boolean) => void) => void;
  }
}

/** Reopens Google's consent message where EU rules apply. */
function CookieSettings({ label }: { label: string }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!ADS_LIVE) return;
    const fc = (window.googlefc ??= {});
    (fc.callbackQueue ??= []).push({
      CONSENT_API_READY: () =>
        window.__tcfapi?.("addEventListener", 0, (data, success) => setShown(success && Boolean(data?.gdprApplies))),
    });
  }, []);

  if (!shown) return null;
  return (
    <button type="button" className="hover:text-ink" onClick={() => window.googlefc?.showRevocationMessage?.()}>
      {label}
    </button>
  );
}

export function Footer({ dataDocs }: { dataDocs: boolean }) {
  const { t, href } = useI18n();
  if (splitLocale(usePathname()).path === "/explore") return null;
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-2 px-4 py-6 text-xs text-ink-3 sm:flex-row sm:justify-between sm:px-6">
        <p>{t.footer.note}</p>
        <p className="flex flex-wrap gap-x-4 gap-y-1.5 whitespace-nowrap">
          <Link href={href("/oppaat")} className="hover:text-ink">
            {t.footer.guides}
          </Link>
          <Link href={href("/about")} className="hover:text-ink">
            {t.footer.about}
          </Link>
          <Link href={href("/contact")} className="hover:text-ink">
            {t.footer.contact}
          </Link>
          <Link href={href("/methodology")} className="hover:text-ink">
            {t.footer.methodology}
          </Link>
          <Link href={href("/privacy")} className="hover:text-ink">
            {t.footer.privacy}
          </Link>
          <Link href={href("/terms")} className="hover:text-ink">
            {t.footer.terms}
          </Link>
          <CookieSettings label={t.footer.cookies} />
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
