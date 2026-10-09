import type { MetadataRoute } from "next";
import { LOCALES, localePath } from "@/i18n/config";
import { guideSlugs } from "@/lib/guides";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";
const PAGES = ["/", "/explore", "/compare", "/ask", "/oppaat", "/methodology", "/about", "/contact", "/privacy", "/terms"];

const url = (locale: (typeof LOCALES)[number], page: string) => `${SITE_URL}${localePath(locale, page)}`;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const guides = (await guideSlugs()).map((slug) => `/oppaat/${slug}`);
  return [...PAGES, ...guides].flatMap((page) =>
    LOCALES.map((locale) => ({
      url: url(locale, page),
      alternates: { languages: Object.fromEntries(LOCALES.map((language) => [language, url(language, page)])) },
    })),
  );
}
