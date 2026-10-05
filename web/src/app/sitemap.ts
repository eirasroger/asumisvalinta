import type { MetadataRoute } from "next";
import { LOCALES, localePath } from "@/i18n/config";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

const PAGES = ["/", "/explore", "/compare", "/ask", "/methodology", "/about", "/privacy"];

const url = (locale: (typeof LOCALES)[number], page: string) => `${SITE_URL}${localePath(locale, page)}`;

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.flatMap((page) =>
    LOCALES.map((locale) => ({
      url: url(locale, page),
      alternates: { languages: Object.fromEntries(LOCALES.map((language) => [language, url(language, page)])) },
    })),
  );
}
