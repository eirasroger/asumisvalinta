"use client";

import { usePathname, useRouter } from "next/navigation";
import { LOCALE_LINKS, LOCALES, localePath, splitLocale } from "@/i18n/config";
import { useI18n } from "@/i18n/I18nProvider";

/** Links to the same page in the other languages, each named in its own language. */
export function LanguageSwitch() {
  const { locale } = useI18n();
  const router = useRouter();
  const { path } = splitLocale(usePathname());
  return (
    <div className="ml-auto flex shrink-0 gap-3 text-sm">
      {LOCALES.filter((other) => other !== locale).map((other) => (
        <a
          key={other}
          href={localePath(other, path)}
          hrefLang={other}
          lang={other}
          className="text-ink-3 whitespace-nowrap hover:text-ink"
          // Keep the flat or area in view when switching language.
          onClick={(event) => {
            event.preventDefault();
            router.push(`${localePath(other, path)}${window.location.search}`);
          }}
        >
          {LOCALE_LINKS[other]}
        </a>
      ))}
    </div>
  );
}
